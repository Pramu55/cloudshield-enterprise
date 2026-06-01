import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@cloudshield/database";
import { verifyAccessToken } from "@cloudshield/security";

declare module "fastify" {
  interface FastifyRequest {
    auth?: {
      userId: string;
      organizationId: string;
      email: string;
      role: string;
    };
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    reply.status(401).send({
      error: "unauthorized",
      message: "Missing bearer token."
    });
    return;
  }

  try {
    const token = authHeader.slice("Bearer ".length);
    const payload = verifyAccessToken(token, request.server.config.JWT_SECRET);
    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        organizationId: payload.organizationId
      },
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      reply.status(401).send({
        error: "unauthorized",
        message: "Authenticated user no longer exists."
      });
      return;
    }

    request.auth = {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role
    };
  } catch {
    reply.status(401).send({
      error: "unauthorized",
      message: "Invalid or expired bearer token."
    });
  }
}

export function getAuthContext(request: FastifyRequest) {
  if (!request.auth) {
    throw new Error("Authenticated tenant context is required.");
  }

  return request.auth;
}
