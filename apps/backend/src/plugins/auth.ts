import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@cloudshield/database";
import { createHash } from "crypto";

declare module "fastify" {
  interface FastifyRequest {
    auth?: {
      userId: string;
      organizationId: string;
      email: string;
      role: string;
      sessionId: string;
    };
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const cookieSession = request.cookies.cloudshield_session;

  if (!cookieSession) {
    reply.status(401).send({
      error: "unauthorized",
      message: "Missing session cookie."
    });
    return;
  }

  try {
    const tokenHash = createHash("sha256").update(cookieSession).digest("hex");
    
    const session = await prisma.authSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            organizationId: true,
            email: true,
            role: true,
            status: true,
            organizationMemberships: {
              where: { status: "ACTIVE" },
              select: { organizationId: true, role: true, status: true }
            }
          }
        }
      }
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      reply.status(401).send({
        error: "unauthorized",
        message: "Invalid or expired session."
      });
      return;
    }

    if (session.user.status !== "ACTIVE") {
      reply.status(401).send({
        error: "unauthorized",
        message: "User account is disabled."
      });
      return;
    }

    if (session.organizationId !== session.user.organizationId) {
      reply.status(401).send({
        error: "unauthorized",
        message: "Session organization is no longer valid."
      });
      return;
    }

    const membership = session.user.organizationMemberships.find(
      (item) => item.organizationId === session.organizationId && item.status === "ACTIVE"
    );

    if (!membership) {
      reply.status(401).send({
        error: "unauthorized",
        message: "Active organization membership is required."
      });
      return;
    }

    await prisma.authSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() }
    });

    request.auth = {
      userId: session.user.id,
      organizationId: session.organizationId,
      email: session.user.email,
      role: membership.role || session.user.role,
      sessionId: session.id
    };
  } catch (error) {
    reply.status(401).send({
      error: "unauthorized",
      message: "Authentication failed."
    });
  }
}

export function getAuthContext(request: FastifyRequest) {
  if (!request.auth) {
    throw new Error("Authenticated tenant context is required.");
  }
  return request.auth;
}
