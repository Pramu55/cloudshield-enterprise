import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import {
  CurrentUserResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  RegisterRequestSchema,
  RegisterResponseSchema
} from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";
import { getAuthContext, requireAuth } from "../plugins/auth.js";

function getCookieOptions() {
  const secureCookie = process.env.AUTH_COOKIE_SECURE === "true";
  return {
    path: "/",
    httpOnly: true,
    secure: secureCookie,
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    sameSite: "lax" as const,
    maxAge: parseInt(process.env.AUTH_SESSION_TTL_HOURS || "24", 10) * 3600 * 1000
  };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = LoginRequestSchema.parse(request.body);
    const user = await prisma.user.findFirst({
      where: {
        email: body.email
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    if (!user?.passwordHash) {
      reply.status(401).send({ error: "invalid_credentials", message: "Invalid email or password." });
      return;
    }

    if (user.status !== "ACTIVE") {
      reply.status(401).send({ error: "account_disabled", message: "Your account has been disabled." });
      return;
    }

    const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);

    if (!passwordMatches) {
      reply.status(401).send({ error: "invalid_credentials", message: "Invalid email or password." });
      return;
    }

    const sessionId = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(sessionId).digest("hex");
    
    const expiresInHours = parseInt(process.env.AUTH_SESSION_TTL_HOURS || "24", 10);
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

    await prisma.authSession.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        tokenHash,
        userAgent: request.headers["user-agent"]?.substring(0, 255),
        ipAddress: request.ip?.substring(0, 45),
        expiresAt
      }
    });

    reply.setCookie("cloudshield_session", sessionId, getCookieOptions());

    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
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

  app.post("/api/v1/auth/register", async (request, reply) => {
    const body = RegisterRequestSchema.parse(request.body);

    if (body.password !== body.confirmPassword) {
      reply.status(400).send({ error: "password_mismatch", message: "Passwords do not match." });
      return;
    }

    const emailNormalized = body.email.toLowerCase().trim();
    const existingUser = await prisma.user.findFirst({
      where: { emailNormalized }
    });

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
        data: { name: body.organization, slug: finalSlug }
      });

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: body.email,
          emailNormalized,
          name: body.email.split("@")[0] || "Owner",
          passwordHash,
          role: "admin"
        }
      });

      await tx.team.create({
        data: { organizationId: org.id, name: "Platform Engineering", businessUnit: "Default" }
      });

      const sessionId = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(sessionId).digest("hex");
      const expiresInHours = parseInt(process.env.AUTH_SESSION_TTL_HOURS || "24", 10);
      const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

      await tx.authSession.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          tokenHash,
          userAgent: request.headers["user-agent"]?.substring(0, 255),
          ipAddress: request.ip?.substring(0, 45),
          expiresAt
        }
      });

      return { org, user, sessionId };
    });

    reply.setCookie("cloudshield_session", result.sessionId, getCookieOptions());

    return RegisterResponseSchema.parse({
      success: true,
      message: "Workspace created.",
      user: { id: result.user.id, email: result.user.email, role: result.user.role, organizationId: result.user.organizationId },
      organization: { id: result.org.id, name: result.org.name, slug: result.org.slug }
    });
  });

  app.post("/api/v1/auth/logout", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    
    await prisma.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() }
    });

    reply.clearCookie("cloudshield_session", {
      path: "/",
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined
    });

    return { status: "ok" };
  });
}
