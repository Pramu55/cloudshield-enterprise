import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import {
  CurrentUserResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema
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

  app.post("/api/v1/auth/logout", async () => {
    return {
      status: "ok"
    };
  });
}
