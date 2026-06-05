import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import {
  CurrentUserResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema
} from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";
import { getAuthContext, requireAuth } from "../plugins/auth.js";

const DUMMY_PASSWORD_HASH = "$2b$12$2Sp35sNA7RT0pIqHOAqQOecgoVVdRw1YAdHbbmepaeTX9o6LLEFH6";

function getCookieOptions() {
  const secureCookie = process.env.AUTH_COOKIE_SECURE === "true";
  return {
    path: "/",
    httpOnly: true,
    secure: secureCookie,
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    sameSite: "lax" as const,
    maxAge: parseInt(process.env.AUTH_SESSION_TTL_HOURS || "24", 10) * 3600
  };
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newRawToken() {
  return randomBytes(32).toString("hex");
}

function getSourceKey(request: any) {
  return String(request.ip ?? request.headers["x-forwarded-for"] ?? "unknown").slice(0, 120);
}

function loginRateKey(request: any) {
  const email = typeof request.body?.email === "string" ? normalizeEmail(request.body.email) : "unknown";
  return `login:${getSourceKey(request)}:${email}`;
}

function emailRateKey(prefix: string) {
  return (request: any) => {
    const email = typeof request.body?.email === "string" ? normalizeEmail(request.body.email) : "unknown";
    return `${prefix}:${getSourceKey(request)}:${email}`;
  };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/auth/csrf", {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: "1 minute",
        keyGenerator: (request: any) => `csrf:${getSourceKey(request)}`
      }
    }
  }, async (request, reply) => {
    const userInfo = request.cookies?.cloudshield_session || "guest";
    const token = await reply.generateCsrf({ userInfo });
    return { token };
  });

  app.post("/api/v1/auth/login", {
    onRequest: app.csrfProtection,
    config: { rateLimit: { max: 8, timeWindow: "1 minute", keyGenerator: loginRateKey } }
  }, async (request, reply) => {
    const body = LoginRequestSchema.parse(request.body);
    const emailNormalized = normalizeEmail(body.email);
    const user = await prisma.user.findFirst({
      where: {
        emailNormalized
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true }
        },
        organizationMemberships: {
          where: { status: "ACTIVE" },
          select: { organizationId: true, role: true }
        }
      }
    });

    const passwordMatches = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    const membership = user?.organizationMemberships.find((item) => item.organizationId === user.organizationId);

    if (!user?.passwordHash || user.status !== "ACTIVE" || !membership || !passwordMatches) {
      reply.status(401).send({ error: "invalid_credentials", message: "Invalid email or password." });
      return;
    }

    const sessionId = newRawToken();
    const tokenHash = hashToken(sessionId);

    const expiresInHours = parseInt(process.env.AUTH_SESSION_TTL_HOURS || "24", 10);
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.authSession.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          tokenHash,
          userAgent: request.headers["user-agent"]?.substring(0, 255),
          ipAddress: request.ip?.substring(0, 45),
          expiresAt
        }
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      await tx.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "auth.login",
          targetType: "user",
          targetId: user.id,
          metadata: { sessionId: session.id }
        }
      });

      return session;
    });

    reply.setCookie("cloudshield_session", sessionId, getCookieOptions());

    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership.role || user.role,
      organizationId: user.organizationId
    };

    return LoginResponseSchema.parse({
      user: authUser,
      organization: user.organization
    });
  });

  app.get(
    "/api/v1/auth/me",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const user = await prisma.user.findFirst({
        where: { id: auth.userId, organizationId: auth.organizationId },
        include: {
          organization: { select: { id: true, name: true, slug: true } }
        }
      });

      if (!user) {
        reply.status(401).send({ error: "unauthorized", message: "Authenticated user no longer exists." });
        return;
      }

      return CurrentUserResponseSchema.parse({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
        organization: user.organization
      });
    }
  );

  app.post("/api/v1/auth/register", {
    onRequest: app.csrfProtection,
    config: { rateLimit: { max: 5, timeWindow: "1 hour", keyGenerator: (request: any) => `register:${getSourceKey(request)}` } }
  }, async (request, reply) => {
    const body = RegisterRequestSchema.parse(request.body);

    if (body.password !== body.confirmPassword) {
      reply.status(400).send({ error: "password_mismatch", message: "Passwords do not match." });
      return;
    }

    const emailNormalized = normalizeEmail(body.email);
    const existingUser = await prisma.user.findUnique({ where: { emailNormalized } });

    if (existingUser) {
      reply.status(409).send({ error: "duplicate_user", message: "This email already has access. Please sign in instead." });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const slug = body.organization.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const existingOrg = await prisma.organization.findUnique({ where: { slug } });
    const finalSlug = existingOrg ? `${slug}-${Math.random().toString(36).substring(2, 7)}` : slug;

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: body.organization,
          slug: finalSlug,
          onboardingState: "REGISTERED",
          awsChangeExecutionEnabled: false
        }
      });

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: body.email,
          emailNormalized,
          name: body.name,
          passwordHash,
          role: "admin",
          lastLoginAt: new Date()
        }
      });

      await tx.organizationMembership.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "admin",
          status: "ACTIVE"
        }
      });

      await tx.organizationSettings.create({
        data: {
          organizationId: org.id,
          dataMode: process.env.CLOUDSHIELD_DATA_MODE === "production" ? "production" : "development",
          sampleDataVisible: false,
          allowedRegions: []
        }
      });

      await tx.organizationOnboarding.create({
        data: {
          organizationId: org.id,
          state: "REGISTERED",
          checklist: {
            accountRegistryCreated: false,
            awsValidationCompleted: false,
            sampleDataImported: false
          }
        }
      });

      const sessionId = newRawToken();
      const tokenHash = hashToken(sessionId);
      const expiresInHours = parseInt(process.env.AUTH_SESSION_TTL_HOURS || "24", 10);
      const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

      const session = await tx.authSession.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          tokenHash,
          userAgent: request.headers["user-agent"]?.substring(0, 255),
          ipAddress: request.ip?.substring(0, 45),
          expiresAt
        }
      });

      await tx.auditEvent.create({
        data: {
          organizationId: org.id,
          actorUserId: user.id,
          action: "auth.register",
          targetType: "user",
          targetId: user.id,
          metadata: { sessionId: session.id, orgSlug: org.slug }
        }
      });

      return { org, user, sessionId };
    });

    reply.setCookie("cloudshield_session", result.sessionId, getCookieOptions());

    return RegisterResponseSchema.parse({
      success: true,
      message: "Workspace created.",
      user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role, organizationId: result.user.organizationId },
      organization: { id: result.org.id, name: result.org.name, slug: result.org.slug }
    });
  });

  app.post("/api/v1/auth/logout", { onRequest: app.csrfProtection }, async (request, reply) => {
    const rawSession = request.cookies.cloudshield_session;

    if (rawSession) {
      const tokenHash = hashToken(rawSession);
      await prisma.$transaction(async (tx) => {
        const session = await tx.authSession.findUnique({
          where: { tokenHash },
          select: { id: true, organizationId: true, userId: true, revokedAt: true }
        });

        if (!session) return;

        if (!session.revokedAt) {
          await tx.authSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date() }
          });
        }

        await tx.auditEvent.create({
          data: {
            organizationId: session.organizationId,
            actorUserId: session.userId,
            action: "auth.logout",
            targetType: "auth_session",
            targetId: session.id,
            metadata: { idempotent: Boolean(session.revokedAt) }
          }
        });
      });
    }

    reply.clearCookie("cloudshield_session", {
      path: "/",
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined
    });

    return { status: "ok" };
  });

  app.post("/api/v1/auth/logout-all", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);

    await prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: { userId: auth.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      await tx.auditEvent.create({
        data: {
          organizationId: auth.organizationId,
          actorUserId: auth.userId,
          action: "auth.logout_all",
          targetType: "user",
          targetId: auth.userId,
          metadata: {}
        }
      });
    });

    reply.clearCookie("cloudshield_session", {
      path: "/",
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined
    });

    return { status: "ok" };
  });

  app.post("/api/v1/auth/forgot-password", {
    onRequest: app.csrfProtection,
    config: { rateLimit: { max: 5, timeWindow: "1 hour", keyGenerator: emailRateKey("forgot-password") } }
  }, async (request, reply) => {
    const body = ForgotPasswordRequestSchema.parse(request.body);
    const emailNormalized = normalizeEmail(body.email);

    const user = await prisma.user.findFirst({
      where: { emailNormalized, status: "ACTIVE" }
    });

    const genericResponse = {
      status: "ok",
      message: "If your email is registered, password reset instructions will be available through the configured delivery channel."
    };

    if (user) {
      const resetToken = newRawToken();
      const tokenHash = hashToken(resetToken);

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt
          }
        });

        await tx.auditEvent.create({
          data: {
            organizationId: user.organizationId,
            actorUserId: user.id,
            action: "auth.forgot_password",
            targetType: "user",
            targetId: user.id,
            metadata: {}
          }
        });
      });

      request.log.info({ userId: user.id, mailProviderConfigured: false }, "Password reset token generated and stored as a hash.");
    }

    return genericResponse;
  });

  app.post("/api/v1/auth/reset-password", {
    onRequest: app.csrfProtection,
    config: { rateLimit: { max: 5, timeWindow: "15 minutes", keyGenerator: (request: any) => `reset-password:${getSourceKey(request)}` } }
  }, async (request, reply) => {
    const body = ResetPasswordRequestSchema.parse(request.body);

    if (body.newPassword !== body.confirmNewPassword) {
      reply.status(400).send({ error: "password_mismatch", message: "Passwords do not match." });
      return;
    }

    const tokenHash = hashToken(body.token);
    const passwordHash = await bcrypt.hash(body.newPassword, 12);

    const resetResult = await prisma.$transaction(async (tx) => {
      const resetRecord = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true }
      });

      if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
        return { ok: false as const, status: 400, error: "invalid_token", message: "Invalid or expired reset token." };
      }

      if (resetRecord.user.status !== "ACTIVE") {
        return { ok: false as const, status: 401, error: "invalid_token", message: "Invalid or expired reset token." };
      }

      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() }
      });

      await tx.user.update({
        where: { id: resetRecord.user.id },
        data: { passwordHash, passwordChangedAt: new Date() }
      });

      await tx.authSession.updateMany({
        where: { userId: resetRecord.user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      await tx.auditEvent.create({
        data: {
          organizationId: resetRecord.user.organizationId,
          actorUserId: resetRecord.user.id,
          action: "auth.reset_password",
          targetType: "user",
          targetId: resetRecord.user.id,
          metadata: {}
        }
      });
      return { ok: true as const };
    });

    if (!resetResult.ok) {
      reply.status(resetResult.status).send({ error: resetResult.error, message: resetResult.message });
      return;
    }

    return { status: "ok", message: "Password updated successfully. Please log in with your new password." };
  });
}
