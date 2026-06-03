import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import {
  CurrentUserResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  RegisterRequestSchema,
  RegisterResponseSchema
} from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";
import { signAccessToken } from "@cloudshield/security";
import { getAuthContext, requireAuth } from "../plugins/auth.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = LoginRequestSchema.parse(request.body);
    const user = await prisma.user.findFirst({
      where: {
        email: body.email
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (!user?.passwordHash) {
      reply.status(401).send({
        error: "invalid_credentials",
        message: "Invalid email or password."
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);

    if (!passwordMatches) {
      reply.status(401).send({
        error: "invalid_credentials",
        message: "Invalid email or password."
      });
      return;
    }

    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId
    };

    const accessToken = signAccessToken(
      {
        sub: user.id,
        organizationId: user.organizationId,
        email: user.email,
        role: user.role
      },
      app.config.JWT_SECRET
    );

    return LoginResponseSchema.parse({
      accessToken,
      user: authUser,
      organization: user.organization
    });
  });

  app.get(
    "/api/v1/auth/me",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const user = await prisma.user.findFirst({
        where: {
          id: auth.userId,
          organizationId: auth.organizationId
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      if (!user) {
        reply.status(401).send({
          error: "unauthorized",
          message: "Authenticated user no longer exists."
        });
        return;
      }

      return CurrentUserResponseSchema.parse({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId
        },
        organization: user.organization
      });
    }
  );

  app.post("/api/v1/auth/register", async (request, reply) => {
    const body = RegisterRequestSchema.parse(request.body);

    if (body.password !== body.confirmPassword) {
      reply.status(400).send({
        error: "password_mismatch",
        message: "Passwords do not match."
      });
      return;
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: body.email
      }
    });

    if (existingUser) {
      reply.status(409).send({
        error: "duplicate_user",
        message: "This email already has access. Please sign in instead."
      });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const slug = body.organization
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const existingOrg = await prisma.organization.findUnique({
      where: { slug }
    });
    const finalSlug = existingOrg
      ? `${slug}-${Math.random().toString(36).substring(2, 7)}`
      : slug;

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: body.organization,
          slug: finalSlug
        }
      });

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: body.email,
          name: body.email.split("@")[0] || "Owner",
          passwordHash,
          role: "admin"
        }
      });

      await tx.team.create({
        data: {
          organizationId: org.id,
          name: "Platform Engineering",
          businessUnit: "Local evaluation"
        }
      });

      return { org, user };
    });

    return RegisterResponseSchema.parse({
      success: true,
      message: "Workspace request created.",
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        organizationId: result.user.organizationId
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug
      }
    });
  });

  app.post("/api/v1/auth/logout", async () => {
    return {
      status: "ok"
    };
  });
}
