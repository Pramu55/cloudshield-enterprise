import type { FastifyInstance } from "fastify";
import { prisma } from "@cloudshield/database";
import { requireAuth, getAuthContext } from "../plugins/auth.js";
import { requirePermission, PERMISSIONS } from "@cloudshield/security";
import {
  CreateTeamRequestSchema,
  UpdateTeamRequestSchema,
  AddTeamMemberRequestSchema,
  UpdateTeamMemberLeadRequestSchema,
  TeamDetailsDto
} from "@cloudshield/contracts";

export async function registerTeamsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/teams", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.TEAMS_READ);

    const teams = await prisma.team.findMany({
      where: { organizationId: auth.organizationId, archivedAt: null },
      include: {
        memberships: {
          include: {
            organizationMembership: { include: { user: true } }
          }
        }
      }
    });

    return {
      teams: teams.map(t => ({
        id: t.id,
        organizationId: t.organizationId,
        name: t.name,
        email: t.email,
        businessUnit: t.businessUnit,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        archivedAt: t.archivedAt?.toISOString() ?? null,
        members: t.memberships.map(m => ({
          id: m.id,
          teamId: m.teamId,
          organizationMembershipId: m.organizationMembershipId,
          userId: m.organizationMembership.userId,
          name: m.organizationMembership.user?.name,
          email: m.organizationMembership.user?.email,
          isLead: m.isLead,
          createdAt: m.createdAt.toISOString()
        }))
      }))
    };
  });

  app.post("/api/v1/teams", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.TEAMS_CREATE);

    const body = CreateTeamRequestSchema.parse(request.body);

    const existing = await prisma.team.findUnique({
      where: { organizationId_name: { organizationId: auth.organizationId, name: body.name } }
    });

    if (existing) {
      reply.status(409).send({ error: "conflict", message: "Team name already exists." });
      return;
    }

    const team = await prisma.team.create({
      data: {
        organizationId: auth.organizationId,
        name: body.name,
        email: body.email ?? null,
        businessUnit: body.businessUnit ?? null
      }
    });

    return { status: "ok", team };
  });

  app.patch("/api/v1/teams/:teamId", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.TEAMS_UPDATE);

    const { teamId } = request.params as { teamId: string };
    const body = UpdateTeamRequestSchema.parse(request.body);

    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId: auth.organizationId, archivedAt: null }
    });

    if (!team) {
      reply.status(404).send({ error: "not_found", message: "Team not found or archived." });
      return;
    }

    if (body.name && body.name !== team.name) {
      const existing = await prisma.team.findUnique({
        where: { organizationId_name: { organizationId: auth.organizationId, name: body.name } }
      });
      if (existing) {
        reply.status(409).send({ error: "conflict", message: "Team name already exists." });
        return;
      }
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.businessUnit !== undefined && { businessUnit: body.businessUnit })
      }
    });

    return { status: "ok", team: updated };
  });

  app.post("/api/v1/teams/:teamId/archive", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.TEAMS_ARCHIVE);

    const { teamId } = request.params as { teamId: string };

    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId: auth.organizationId }
    });

    if (!team || team.archivedAt) {
      reply.status(404).send({ error: "not_found", message: "Team not found or already archived." });
      return;
    }

    await prisma.team.update({
      where: { id: teamId },
      data: { archivedAt: new Date() }
    });

    return { status: "ok", message: "Team archived." };
  });

  app.post("/api/v1/teams/:teamId/members", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.TEAMS_MEMBERS_MANAGE);

    const { teamId } = request.params as { teamId: string };
    const body = AddTeamMemberRequestSchema.parse(request.body);

    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId: auth.organizationId, archivedAt: null }
    });

    if (!team) {
      reply.status(404).send({ error: "not_found", message: "Team not found or archived." });
      return;
    }

    const orgMember = await prisma.organizationMembership.findFirst({
      where: { id: body.organizationMembershipId, organizationId: auth.organizationId, status: "ACTIVE" }
    });

    if (!orgMember) {
      reply.status(404).send({ error: "not_found", message: "Active organization member not found." });
      return;
    }

    const existing = await prisma.teamMembership.findUnique({
      where: { teamId_organizationMembershipId: { teamId, organizationMembershipId: body.organizationMembershipId } }
    });

    if (existing) {
      reply.status(409).send({ error: "conflict", message: "Member is already in the team." });
      return;
    }

    const tm = await prisma.teamMembership.create({
      data: {
        organizationId: auth.organizationId,
        teamId,
        organizationMembershipId: body.organizationMembershipId,
        isLead: false
      }
    });

    return { status: "ok", membership: tm };
  });

  app.delete("/api/v1/teams/:teamId/members/:organizationMembershipId", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.TEAMS_MEMBERS_MANAGE);

    const { teamId, organizationMembershipId } = request.params as { teamId: string, organizationMembershipId: string };

    const tm = await prisma.teamMembership.findUnique({
      where: { teamId_organizationMembershipId: { teamId, organizationMembershipId } }
    });

    if (!tm || tm.organizationId !== auth.organizationId) {
      reply.status(404).send({ error: "not_found", message: "Team membership not found." });
      return;
    }

    await prisma.teamMembership.delete({
      where: { id: tm.id }
    });

    return { status: "ok", message: "Member removed from team." };
  });

  app.patch("/api/v1/teams/:teamId/members/:organizationMembershipId/lead", { preHandler: requireAuth, onRequest: app.csrfProtection }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.TEAMS_MEMBERS_MANAGE);

    const { teamId, organizationMembershipId } = request.params as { teamId: string, organizationMembershipId: string };
    const body = UpdateTeamMemberLeadRequestSchema.parse(request.body);

    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId: auth.organizationId, archivedAt: null }
    });

    if (!team) {
      reply.status(404).send({ error: "not_found", message: "Team not found or archived." });
      return;
    }

    const tm = await prisma.teamMembership.findUnique({
      where: { teamId_organizationMembershipId: { teamId, organizationMembershipId } }
    });

    if (!tm || tm.organizationId !== auth.organizationId) {
      reply.status(404).send({ error: "not_found", message: "Team membership not found." });
      return;
    }

    const updated = await prisma.teamMembership.update({
      where: { id: tm.id },
      data: { isLead: body.isLead }
    });

    return { status: "ok", membership: updated };
  });
}
