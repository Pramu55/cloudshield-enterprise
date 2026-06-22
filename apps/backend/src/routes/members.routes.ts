import type { FastifyInstance } from "fastify";
import { prisma } from "@cloudshield/database";
import { requireAuth, getAuthContext } from "../plugins/auth.js";
import {
  MembersListResponseSchema,
  CreateInvitationRequestSchema,
  AcceptInvitationRequestSchema,
  UpdateMemberRoleRequestSchema,
  InvitationDtoSchema,
  MemberDtoSchema
} from "@cloudshield/contracts";
import { randomBytes, createHash } from "crypto";
import { requirePermission, PERMISSIONS, ROLES } from "@cloudshield/security";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newRawToken() {
  return randomBytes(32).toString("hex");
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

export async function registerMembersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/members", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MEMBERS_READ);

    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: auth.organizationId, status: "ACTIVE" },
      include: { user: true }
    });

    const invitations = await prisma.invitation.findMany({
      where: { organizationId: auth.organizationId }
    });

    // Determine if there is only one active owner
    const owners = members.filter(m => m.role === ROLES.OWNER);
    const finalOwnerId = owners.length === 1 ? owners[0]?.userId : null;

    return MembersListResponseSchema.parse({
      members: members.map(m => ({
        id: m.id,
        userId: m.userId,
        name: m.user?.name ?? null,
        email: m.user?.email ?? "",
        role: m.role,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        isFinalOwner: m.userId === finalOwnerId
      })),
      invitations: invitations.map(i => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.acceptedAt ? "ACCEPTED" : i.revokedAt ? "REVOKED" : i.expiresAt < new Date() ? "EXPIRED" : "PENDING",
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString()
      }))
    });
  });

  app.post("/api/v1/members/invite", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MEMBERS_INVITE);

    const body = CreateInvitationRequestSchema.parse(request.body);
    const email = normalizeEmail(body.email);

    const existingMember = await prisma.user.findFirst({
      where: {
        emailNormalized: email,
        organizationMemberships: {
          some: { organizationId: auth.organizationId, status: "ACTIVE" }
        }
      }
    });

    if (existingMember) {
      reply.status(409).send({ error: "already_member", message: "User is already a member." });
      return;
    }

    const rawToken = newRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.upsert({
      where: {
        organizationId_email: {
          organizationId: auth.organizationId,
          email
        }
      },
      update: {
        role: body.role,
        tokenHash,
        expiresAt,
        revokedAt: null,
        acceptedAt: null,
        sendCount: { increment: 1 },
        lastSentAt: new Date()
      },
      create: {
        organizationId: auth.organizationId,
        email,
        role: body.role,
        tokenHash,
        expiresAt,
        inviterId: auth.userId
      }
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action: "members.invite",
        targetType: "invitation",
        targetId: invitation.id,
        metadata: { email, role: body.role }
      }
    });

    // In local dev we can preview tokens
    const response: any = { status: "ok", message: "Invitation sent." };
    if (process.env.CLOUDSHIELD_DATA_MODE === "development" && process.env.ENABLE_LOCAL_INVITATION_PREVIEW === "true") {
      response.previewToken = rawToken;
    }

    return response;
  });

  app.post("/api/v1/members/invite/:id/resend", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MEMBERS_INVITE);

    const { id } = request.params as { id: string };

    const rawToken = newRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await prisma.invitation.updateMany({
      where: { id, organizationId: auth.organizationId, acceptedAt: null },
      data: {
        tokenHash,
        expiresAt,
        revokedAt: null,
        sendCount: { increment: 1 },
        lastSentAt: new Date()
      }
    });

    if (result.count !== 1) {
      reply.status(404).send({ error: "not_found", message: "Invitation not found or already accepted." });
      return;
    }

    await prisma.auditEvent.create({
      data: {
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action: "members.invite_resend",
        targetType: "invitation",
        targetId: id,
        metadata: {}
      }
    });

    const response: any = { status: "ok", message: "Invitation resent." };
    if (process.env.CLOUDSHIELD_DATA_MODE === "development" && process.env.ENABLE_LOCAL_INVITATION_PREVIEW === "true") {
      response.previewToken = rawToken;
    }
    return response;
  });

  app.post("/api/v1/members/invite/:id/revoke", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MEMBERS_INVITE);

    const { id } = request.params as { id: string };

    const result = await prisma.invitation.updateMany({
      where: { id, organizationId: auth.organizationId, acceptedAt: null },
      data: { revokedAt: new Date() }
    });

    if (result.count !== 1) {
      reply.status(404).send({ error: "not_found", message: "Invitation not found or already accepted." });
      return;
    }

    await prisma.auditEvent.create({
      data: {
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action: "members.invite_revoke",
        targetType: "invitation",
        targetId: id,
        metadata: {}
      }
    });

    return { status: "ok", message: "Invitation revoked." };
  });

  app.delete("/api/v1/members/:userId", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MEMBERS_REMOVE);

    const { userId } = request.params as { userId: string };

    if (userId === auth.userId) {
      reply.status(400).send({ error: "bad_request", message: "You cannot remove yourself." });
      return;
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId, organizationId: auth.organizationId, status: "ACTIVE" }
    });

    if (!membership) {
      reply.status(404).send({ error: "not_found", message: "Member not found." });
      return;
    }

    if (membership.role === ROLES.OWNER) {
      const ownersCount = await prisma.organizationMembership.count({
        where: { organizationId: auth.organizationId, status: "ACTIVE", role: ROLES.OWNER }
      });
      if (ownersCount <= 1) {
        reply.status(400).send({ error: "final_owner", message: "Cannot remove the final owner." });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationMembership.update({
        where: { id: membership.id },
        data: { status: "REMOVED" }
      });

      // Revoke any active sessions for this user in this org
      await tx.authSession.updateMany({
        where: { userId, organizationId: auth.organizationId, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      await tx.auditEvent.create({
        data: {
          organizationId: auth.organizationId,
          actorUserId: auth.userId,
          action: "members.remove",
          targetType: "user",
          targetId: userId,
          metadata: {}
        }
      });
    });

    return { status: "ok", message: "Member removed." };
  });

  app.patch("/api/v1/members/:userId", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MEMBERS_ROLE_UPDATE);

    const { userId } = request.params as { userId: string };
    const body = UpdateMemberRoleRequestSchema.parse(request.body);

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId, organizationId: auth.organizationId, status: "ACTIVE" }
    });

    if (!membership) {
      reply.status(404).send({ error: "not_found", message: "Member not found." });
      return;
    }

    if (membership.role === ROLES.OWNER && body.role !== ROLES.OWNER) {
      const ownersCount = await prisma.organizationMembership.count({
        where: { organizationId: auth.organizationId, status: "ACTIVE", role: ROLES.OWNER }
      });
      if (ownersCount <= 1) {
        reply.status(400).send({ error: "final_owner", message: "Cannot demote the final owner." });
        return;
      }
    }

    await prisma.organizationMembership.update({
      where: { id: membership.id },
      data: { role: body.role }
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action: "members.update_role",
        targetType: "user",
        targetId: userId,
        metadata: { oldRole: membership.role, newRole: body.role }
      }
    });

    return { status: "ok", message: "Member updated." };
  });

  // Preview an invitation
  app.get("/api/v1/invitations/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const tokenHash = hashToken(token);

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        organization: { select: { name: true, slug: true } },
        inviter: { select: { name: true, email: true } }
      }
    });

    if (!invitation || invitation.revokedAt || invitation.expiresAt < new Date()) {
      reply.status(404).send({ error: "invalid_invitation", message: "Invitation is invalid or expired." });
      return;
    }

    if (invitation.acceptedAt) {
      reply.status(400).send({ error: "already_accepted", message: "Invitation already accepted." });
      return;
    }

    return {
      email: invitation.email,
      organization: invitation.organization,
      inviter: invitation.inviter
    };
  });

  // Accept an invitation for an existing user
  app.post("/api/v1/invitations/accept", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    const body = AcceptInvitationRequestSchema.parse(request.body);
    const tokenHash = hashToken(body.token);

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: { organization: true }
    });

    if (!invitation || invitation.revokedAt || invitation.expiresAt < new Date() || invitation.acceptedAt) {
      reply.status(400).send({ error: "invalid_invitation", message: "Invitation is invalid or expired." });
      return;
    }

    if (normalizeEmail(auth.email) !== normalizeEmail(invitation.email)) {
      reply.status(403).send({ error: "email_mismatch", message: "This invitation is for a different email address." });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const existingMembership = await tx.organizationMembership.findFirst({
        where: { userId: auth.userId, organizationId: invitation.organizationId }
      });

      if (existingMembership) {
        if (existingMembership.status !== "ACTIVE") {
          await tx.organizationMembership.update({
            where: { id: existingMembership.id },
            data: { status: "ACTIVE", role: invitation.role }
          });
        }
      } else {
        await tx.organizationMembership.create({
          data: {
            userId: auth.userId,
            organizationId: invitation.organizationId,
            role: invitation.role,
            status: "ACTIVE"
          }
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() }
      });

      await tx.auditEvent.create({
        data: {
          organizationId: invitation.organizationId,
          actorUserId: auth.userId,
          action: "members.invitation_accepted",
          targetType: "invitation",
          targetId: invitation.id,
          metadata: {}
        }
      });
    });

    return { status: "ok", message: "Invitation accepted. You can now switch to the new workspace." };
  });
}
