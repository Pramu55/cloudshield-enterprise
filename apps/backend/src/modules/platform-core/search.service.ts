import { prisma } from "@cloudshield/database";
import type { FastifyRequest } from "fastify";
import { hasPermission, PERMISSIONS } from "@cloudshield/security";
import { GlobalSearchEntityType, GlobalSearchGroup, GlobalSearchResponse, GlobalSearchResult } from "@cloudshield/contracts";

type AuthContext = { userId: string, organizationId: string, email: string, role: string };

export async function performGlobalSearch(
  auth: AuthContext,
  query: string,
  requestedTypes: GlobalSearchEntityType[] | undefined,
  limitPerGroup: number
): Promise<GlobalSearchResponse> {
  const allowedTypes = new Set<GlobalSearchEntityType>();

  // Determine which entities the user is allowed to search
  if (hasPermission(auth.role, PERMISSIONS.ACCOUNTS_READ)) allowedTypes.add("awsAccount");
  if (hasPermission(auth.role, PERMISSIONS.INVENTORY_READ)) allowedTypes.add("resource");
  if (hasPermission(auth.role, PERMISSIONS.FINDINGS_READ)) allowedTypes.add("finding");
  // using INVENTORY_READ for compliance for now, or just mapping to standard read
  if (hasPermission(auth.role, PERMISSIONS.INVENTORY_READ)) allowedTypes.add("complianceControl");
  if (hasPermission(auth.role, PERMISSIONS.OPERATIONS_READ)) allowedTypes.add("operation");
  if (hasPermission(auth.role, PERMISSIONS.RECOMMENDATIONS_READ)) allowedTypes.add("recommendation");
  if (hasPermission(auth.role, PERMISSIONS.REPORTS_READ)) allowedTypes.add("report");
  if (hasPermission(auth.role, PERMISSIONS.AUDIT_READ)) allowedTypes.add("auditEvent");
  if (hasPermission(auth.role, PERMISSIONS.INVENTORY_READ)) allowedTypes.add("evidence");
  if (hasPermission(auth.role, PERMISSIONS.INVENTORY_SCAN_REQUEST) || hasPermission(auth.role, PERMISSIONS.INVENTORY_READ)) allowedTypes.add("scanRun");
  if (hasPermission(auth.role, PERMISSIONS.OPERATIONS_READ)) allowedTypes.add("governance");

  // special logic for teams and members
  const canViewTeams = hasPermission(auth.role, PERMISSIONS.TEAMS_READ);
  if (canViewTeams || auth.role === "VIEWER") allowedTypes.add("team");
  if (hasPermission(auth.role, PERMISSIONS.MEMBERS_READ)) allowedTypes.add("member");
  if (hasPermission(auth.role, PERMISSIONS.INVITATIONS_READ)) allowedTypes.add("invitation");

  const typesToSearch = (requestedTypes || Array.from(allowedTypes)).filter(t => allowedTypes.has(t)).slice(0, 8);
  const qLower = query.toLowerCase();

  const groups: GlobalSearchGroup[] = [];

  // Team search visibility constraints:
  // OWNER/ADMIN: all teams
  // SEC/CLOUD_OP/AUDITOR: only if team.view and member of team (unless policy grants organization-wide)
  // VIEWER: only teams in which they have active TeamMembership
  let visibleTeamIds: string[] | null = null; // null means all teams
  if (auth.role !== "OWNER" && auth.role !== "ADMIN") {
    const userTeams = await prisma.teamMembership.findMany({
      where: {
        organizationMembership: {
          userId: auth.userId,
          organizationId: auth.organizationId,
          status: "ACTIVE"
        },
        archivedAt: null
      },
      select: { teamId: true }
    });
    visibleTeamIds = userTeams.map(t => t.teamId);
  }

  const queries: Promise<void>[] = [];

  if (typesToSearch.includes("awsAccount")) {
    queries.push((async () => {
      const accounts = await prisma.awsAccount.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { accountId: { contains: query } }
          ],
          archivedAt: null
        },
        take: limitPerGroup + 1,
        select: { id: true, name: true, accountId: true, environment: true, updatedAt: true }
      });
      if (accounts.length > 0) {
        groups.push({
          type: "awsAccount",
          label: "AWS Accounts",
          hasMore: accounts.length > limitPerGroup,
          results: accounts.slice(0, limitPerGroup).map((a: any) => ({
            id: a.id,
            type: "awsAccount",
            title: a.name,
            subtitle: a.accountId,
            href: `/dashboard/accounts/${a.accountId}`,
            status: a.environment,
            updatedAt: a.updatedAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("resource")) {
    queries.push((async () => {
      const resources = await prisma.cloudResource.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { resourceId: { contains: query, mode: "insensitive" } },
            { arn: { contains: query, mode: "insensitive" } }
          ],
          archivedAt: null
        },
        take: limitPerGroup + 1,
        select: { id: true, name: true, resourceId: true, resourceType: true, awsAccountId: true, updatedAt: true }
      });
      if (resources.length > 0) {
        groups.push({
          type: "resource",
          label: "Cloud Resources",
          hasMore: resources.length > limitPerGroup,
          results: resources.slice(0, limitPerGroup).map((r: any) => ({
            id: r.id,
            type: "resource",
            title: r.name || r.resourceId,
            subtitle: r.resourceType,
            href: `/dashboard/inventory/${r.id}`,
            updatedAt: r.updatedAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("finding")) {
    queries.push((async () => {
      const findings = await prisma.securityFinding.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { ruleId: { contains: query, mode: "insensitive" } }
          ],
          archivedAt: null
        },
        take: limitPerGroup + 1,
        select: { id: true, title: true, severity: true, status: true, ruleId: true, updatedAt: true }
      });
      if (findings.length > 0) {
        groups.push({
          type: "finding",
          label: "Security Findings",
          hasMore: findings.length > limitPerGroup,
          results: findings.slice(0, limitPerGroup).map((f: any) => ({
            id: f.id,
            type: "finding",
            title: f.title,
            subtitle: f.ruleId,
            severity: f.severity,
            status: f.status,
            href: `/dashboard/security/${f.id}`,
            updatedAt: f.updatedAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("team")) {
    queries.push((async () => {
      if (visibleTeamIds && visibleTeamIds.length === 0 && !canViewTeams) {
        // user cannot see any teams
        return;
      }

      const teamWhere: any = {
        organizationId: auth.organizationId,
        name: { contains: query, mode: "insensitive" },
        archivedAt: null
      };

      if (visibleTeamIds !== null) {
        teamWhere.id = { in: visibleTeamIds };
      }

      const teams = await prisma.team.findMany({
        where: teamWhere,
        take: limitPerGroup + 1,
        select: { id: true, name: true, businessUnit: true, updatedAt: true }
      });

      if (teams.length > 0) {
        groups.push({
          type: "team",
          label: "Teams",
          hasMore: teams.length > limitPerGroup,
          results: teams.slice(0, limitPerGroup).map((t: any) => ({
            id: t.id,
            type: "team",
            title: t.name,
            subtitle: t.businessUnit || undefined,
            href: `/dashboard/settings/teams/${t.id}`,
            updatedAt: t.updatedAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("member")) {
    queries.push((async () => {
      const members = await prisma.organizationMembership.findMany({
        where: {
          organizationId: auth.organizationId,
          status: "ACTIVE",
          user: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } }
            ]
          }
        },
        take: limitPerGroup + 1,
        select: { id: true, role: true, updatedAt: true, user: { select: { id: true, name: true, email: true } } }
      });
      if (members.length > 0) {
        groups.push({
          type: "member",
          label: "Members",
          hasMore: members.length > limitPerGroup,
          results: members.slice(0, limitPerGroup).map((m: any) => ({
            id: m.id,
            type: "member",
            title: m.user.name || m.user.email,
            subtitle: m.user.name ? m.user.email : undefined,
            status: m.role,
            href: `/dashboard/settings/members`,
            updatedAt: m.updatedAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("invitation")) {
    queries.push((async () => {
      const invitations = await prisma.invitation.findMany({
        where: {
          organizationId: auth.organizationId,
          acceptedAt: null,
          revokedAt: null,
          email: { contains: query, mode: "insensitive" }
        },
        take: limitPerGroup + 1,
        select: { id: true, email: true, role: true, updatedAt: true }
      });
      if (invitations.length > 0) {
        groups.push({
          type: "invitation",
          label: "Invitations",
          hasMore: invitations.length > limitPerGroup,
          results: invitations.slice(0, limitPerGroup).map((i: any) => ({
            id: i.id,
            type: "invitation",
            title: i.email,
            subtitle: "Pending Invitation",
            status: i.role,
            href: `/dashboard/settings/members`,
            updatedAt: i.updatedAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("scanRun")) {
    queries.push((async () => {
      const scans = await prisma.scanRun.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { id: { contains: query } },
            { jobType: { contains: query, mode: "insensitive" } }
          ]
        },
        take: limitPerGroup + 1,
        orderBy: { createdAt: 'desc' },
        select: { id: true, jobType: true, status: true, updatedAt: true }
      });
      if (scans.length > 0) {
        groups.push({
          type: "scanRun",
          label: "Scans",
          hasMore: scans.length > limitPerGroup,
          results: scans.slice(0, limitPerGroup).map((s: any) => ({
            id: s.id,
            type: "scanRun",
            title: `Scan ${s.id.slice(-8)}`,
            subtitle: s.jobType,
            status: s.status,
            href: `/dashboard/scans/${s.id}`,
            updatedAt: s.updatedAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("complianceControl")) {
    queries.push((async () => {
      const controls = await prisma.complianceControl.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { controlId: { contains: query, mode: "insensitive" } },
            { title: { contains: query, mode: "insensitive" } }
          ]
        },
        take: limitPerGroup + 1,
        select: { id: true, controlId: true, title: true, status: true, severity: true, updatedAt: true }
      });
      if (controls.length > 0) {
        groups.push({
          type: "complianceControl",
          label: "Compliance Controls",
          hasMore: controls.length > limitPerGroup,
          results: controls.slice(0, limitPerGroup).map((c: any) => ({
            id: c.id,
            type: "complianceControl",
            title: c.title,
            subtitle: c.controlId,
            status: c.status,
            severity: c.severity,
            href: `/dashboard/compliance?control=${c.controlId}`,
            updatedAt: c.updatedAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("recommendation")) {
    queries.push((async () => {
      const recs = await prisma.recommendation.findMany({
        where: {
          organizationId: auth.organizationId,
          title: { contains: query, mode: "insensitive" }
        },
        take: limitPerGroup + 1,
        select: { id: true, title: true, actionType: true, createdAt: true }
      });
      if (recs.length > 0) {
        groups.push({
          type: "recommendation",
          label: "Recommendations",
          hasMore: recs.length > limitPerGroup,
          results: recs.slice(0, limitPerGroup).map((r: any) => ({
            id: r.id,
            type: "recommendation",
            title: r.title,
            subtitle: r.actionType,
            href: `/dashboard/recommendations`,
            updatedAt: r.createdAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("operation")) {
    queries.push((async () => {
      const ops = await prisma.remediationPlan.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { id: { contains: query } }
          ]
        },
        take: limitPerGroup + 1,
        select: { id: true, title: true, executionStatus: true, updatedAt: true }
      });
      if (ops.length > 0) {
        groups.push({
          type: "operation",
          label: "Operations",
          hasMore: ops.length > limitPerGroup,
          results: ops.slice(0, limitPerGroup).map((o: any) => ({
            id: o.id,
            type: "operation",
            title: o.title,
            status: o.executionStatus,
            href: `/dashboard/operations/${o.id}`,
            updatedAt: o.updatedAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("report")) {
    queries.push((async () => {
      const reports = await prisma.reportExport.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { id: { contains: query } }
          ],
          archivedAt: null
        },
        take: limitPerGroup + 1,
        select: { id: true, title: true, reportType: true, status: true, createdAt: true }
      });
      if (reports.length > 0) {
        groups.push({
          type: "report",
          label: "Reports",
          hasMore: reports.length > limitPerGroup,
          results: reports.slice(0, limitPerGroup).map((r: any) => ({
            id: r.id,
            type: "report",
            title: r.title || `Report ${r.id.slice(-8)}`,
            subtitle: r.reportType,
            status: r.status,
            href: `/dashboard/reports`,
            updatedAt: r.createdAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("auditEvent")) {
    queries.push((async () => {
      const events = await prisma.auditEvent.findMany({
        where: {
          organizationId: auth.organizationId,
          action: { contains: query, mode: "insensitive" }
        },
        take: limitPerGroup + 1,
        orderBy: { createdAt: 'desc' },
        select: { id: true, action: true, targetType: true, createdAt: true }
      });
      if (events.length > 0) {
        groups.push({
          type: "auditEvent",
          label: "Audit Events",
          hasMore: events.length > limitPerGroup,
          results: events.slice(0, limitPerGroup).map((e: any) => ({
            id: e.id,
            type: "auditEvent",
            title: e.action,
            subtitle: e.targetType,
            href: `/dashboard/settings?tab=audit`,
            updatedAt: e.createdAt.toISOString()
          }))
        });
      }
    })());
  }

  if (typesToSearch.includes("evidence")) {
    queries.push((async () => {
      const evidences = await prisma.complianceEvidence.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { summary: { contains: query, mode: "insensitive" } },
            { controlId: { contains: query, mode: "insensitive" } }
          ]
        },
        take: limitPerGroup + 1,
        select: { id: true, summary: true, controlId: true, status: true, createdAt: true }
      });
      if (evidences.length > 0) {
        groups.push({
          type: "evidence",
          label: "Evidence",
          hasMore: evidences.length > limitPerGroup,
          results: evidences.slice(0, limitPerGroup).map((e: any) => ({
            id: e.id,
            type: "evidence",
            title: e.summary || `Evidence for ${e.controlId}`,
            subtitle: e.controlId,
            status: e.status,
            href: `/dashboard/compliance?control=${e.controlId}`,
            updatedAt: e.createdAt.toISOString()
          }))
        });
      }
    })());
  }

  await Promise.all(queries);

  // Deterministic Ranking
  for (const group of groups) {
    group.results.sort((a: any, b: any) => {
      // 1. Exact ID match
      if (a.id === query || a.subtitle === query) return -1;
      if (b.id === query || b.subtitle === query) return 1;

      // 2. Exact Title match
      const aTitleLow = a.title.toLowerCase();
      const bTitleLow = b.title.toLowerCase();
      if (aTitleLow === qLower) return -1;
      if (bTitleLow === qLower) return 1;

      // 3. Prefix match
      const aPrefix = aTitleLow.startsWith(qLower);
      const bPrefix = bTitleLow.startsWith(qLower);
      if (aPrefix && !bPrefix) return -1;
      if (!aPrefix && bPrefix) return 1;

      // Tie breaker: stable title ordering
      return a.title.localeCompare(b.title);
    });
  }

  // Sort groups deterministically based on standard ordering
  const groupOrder: GlobalSearchEntityType[] = [
    "awsAccount", "resource", "finding", "complianceControl",
    "scanRun", "operation", "recommendation", "governance",
    "auditEvent", "report", "evidence", "team", "member", "invitation"
  ];
  groups.sort((a, b) => groupOrder.indexOf(a.type) - groupOrder.indexOf(b.type));

  const totalResults = groups.reduce((acc, g) => acc + g.results.length, 0);

  return {
    query,
    groups,
    total: totalResults,
    generatedAt: new Date().toISOString()
  };
}
