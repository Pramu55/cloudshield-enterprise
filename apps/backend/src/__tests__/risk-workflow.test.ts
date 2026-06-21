import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { AwsAccountStatus, Environment, prisma } from "@cloudshield/database";
import {
  RiskAcceptanceRegistryResponseSchema,
  RiskFindingDetailDtoSchema,
  RiskWorkflowActionDtoSchema,
  type RiskWorkflowActionName,
  type RiskWorkflowStatus
} from "@cloudshield/contracts";
import { listRiskAcceptances } from "../modules/risk-workflow/risk-workflow.service.js";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";

type Session = {
  csrfToken: string;
  sessionCookie: string;
  orgId: string;
  userId: string;
};

const workflowMatrix: Record<RiskWorkflowStatus, RiskWorkflowActionName[]> = {
  OPEN: ["acknowledge", "assign", "false-positive", "resolve", "archive"],
  REOPENED: ["acknowledge", "assign", "false-positive", "resolve", "archive"],
  ACKNOWLEDGED: ["assign", "plan-remediation", "accept-risk", "false-positive", "resolve", "archive"],
  ASSIGNED: ["assign", "plan-remediation", "accept-risk", "false-positive", "resolve", "archive"],
  REMEDIATION_PLANNED: ["assign", "plan-remediation", "accept-risk", "resolve", "archive"],
  RISK_ACCEPTED: ["reopen", "archive"],
  FALSE_POSITIVE: ["reopen", "archive"],
  RESOLVED: ["reopen", "archive"],
  ARCHIVED: ["reopen"]
};
const workflowActions: RiskWorkflowActionName[] = [
  "acknowledge",
  "assign",
  "plan-remediation",
  "accept-risk",
  "false-positive",
  "resolve",
  "archive",
  "reopen"
];

test("risk finding detail and workflow handoff remain tenant-safe and DB-only", async (t) => {
  const app = await buildApp();
  const tenantA = await registerTenant(app, "risk-detail-a");
  const tenantB = await registerTenant(app, "risk-detail-b");
  const fixtureA = await createFindingFixture(tenantA, "tenant-a");
  const fixtureB = await createFindingFixture(tenantB, "tenant-b");
  const matrixFixture = await createFindingFixture(tenantA, "state-matrix");

  t.after(async () => {
    await prisma.securityFindingEvidenceSnapshot.deleteMany({
      where: { organizationId: { in: [tenantA.orgId, tenantB.orgId] } }
    });
    await prisma.organization.deleteMany({ where: { id: { in: [tenantA.orgId, tenantB.orgId] } } });
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close(),
      securityMonitoringQueue.close()
    ]);
    await prisma.$disconnect();
  });

  await t.test("same-tenant detail returns bounded authoritative provenance", async () => {
    await prisma.auditEvent.createMany({
      data: Array.from({ length: 55 }, (_, index) => ({
        organizationId: tenantA.orgId,
        actorUserId: tenantA.userId,
        action: `risk.finding.test_${index}`,
        targetType: "security_finding",
        targetId: fixtureA.finding.id,
        metadata: { index }
      }))
    });
    await prisma.auditEvent.create({
      data: {
        organizationId: tenantB.orgId,
        actorUserId: tenantB.userId,
        action: "risk.finding.other_tenant",
        targetType: "security_finding",
        targetId: fixtureA.finding.id,
        metadata: {}
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${fixtureA.finding.id}`,
      headers: { cookie: tenantA.sessionCookie }
    });

    assert.equal(response.statusCode, 200, response.body);
    const detail = RiskFindingDetailDtoSchema.parse(response.json());
    assert.equal(detail.findingSource, "RULE_ENGINE");
    assert.equal(detail.resourceSource, "SAMPLE");
    assert.equal(detail.sampleData, true);
    assert.deepEqual(detail.availableActions, workflowMatrix.OPEN);
    assert.equal(detail.auditEvents.length, 50);
    assert.equal(detail.auditEvents.some((event) => event.action === "risk.finding.other_tenant"), false);
  });

  await t.test("unauthenticated, missing, cross-tenant, and disabled access fail safely", async () => {
    const unauthenticated = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${fixtureA.finding.id}`
    });
    assert.equal(unauthenticated.statusCode, 401);

    const crossTenant = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${fixtureB.finding.id}`,
      headers: { cookie: tenantA.sessionCookie }
    });
    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${randomUUID()}`,
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(crossTenant.statusCode, 404);
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(crossTenant.json(), missing.json());

    await prisma.user.update({ where: { id: tenantA.userId }, data: { status: "DISABLED" } });
    const disabled = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${fixtureA.finding.id}`,
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(disabled.statusCode, 401);
    await prisma.user.update({ where: { id: tenantA.userId }, data: { status: "ACTIVE" } });
  });

  await t.test("all workflow POST routes require CSRF without side effects", async () => {
    const actions: Array<{ path: string; body: Record<string, unknown> }> = [
      { path: "acknowledge", body: { note: "Reviewing" } },
      { path: "assign", body: { priority: "P1" } },
      { path: "plan-remediation", body: { remediationPlan: "Review and prepare a safe manual change." } },
      { path: "accept-risk", body: { riskAcceptanceReason: "Approved business exception", riskAcceptedUntil: futureDate() } },
      { path: "false-positive", body: { reason: "Reviewed evidence does not apply." } },
      { path: "resolve", body: { resolutionNote: "Verified resolved." } },
      { path: "archive", body: { archiveReason: "Retained for audit." } },
      { path: "reopen", body: { reason: "Renewed review." } }
    ];

    for (const action of actions) {
      const before = await stateCounts(tenantA.orgId, fixtureA.finding.id);
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/risk/findings/${fixtureA.finding.id}/${action.path}`,
        headers: { cookie: tenantA.sessionCookie },
        payload: action.body
      });
      assert.equal(response.statusCode, 403, `${action.path} must require CSRF`);
      assert.deepEqual(await stateCounts(tenantA.orgId, fixtureA.finding.id), before);
    }
  });

  await t.test("capability denial is side-effect free", async () => {
    await setRole(tenantA, "VIEWER");
    const before = await stateCounts(tenantA.orgId, fixtureA.finding.id);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${fixtureA.finding.id}/acknowledge`,
      headers: unsafeHeaders(tenantA),
      payload: { note: "Unauthorized attempt" }
    });
    assert.equal(response.statusCode, 403);
    assert.deepEqual(await stateCounts(tenantA.orgId, fixtureA.finding.id), before);
    await setRole(tenantA, "OWNER");
  });

  await t.test("valid acknowledge creates one audit event and returns false safety flags", async () => {
    const beforeAudit = await prisma.auditEvent.count({
      where: { organizationId: tenantA.orgId, targetId: fixtureA.finding.id }
    });
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${fixtureA.finding.id}/acknowledge`,
      headers: unsafeHeaders(tenantA),
      payload: { note: "Reviewed through finding detail." }
    });

    assert.equal(response.statusCode, 200, response.body);
    const result = RiskWorkflowActionDtoSchema.parse(response.json());
    assert.equal(result.finding.workflowStatus, "ACKNOWLEDGED");
    assert.equal(result.finding.findingSource, "RULE_ENGINE");
    assert.equal(result.finding.resourceSource, "SAMPLE");
    assert.equal(result.awsApiCallExecuted, false);
    assert.equal(result.mutationExecuted, false);
    assert.equal(result.remediationExecuted, false);
    assert.equal(
      await prisma.auditEvent.count({ where: { organizationId: tenantA.orgId, targetId: fixtureA.finding.id } }),
      beforeAudit + 1
    );
  });

  await t.test("assignment rejects another tenant's team and user", async () => {
    const before = await prisma.securityFinding.findUniqueOrThrow({ where: { id: fixtureA.finding.id } });
    for (const payload of [
      { ownerTeamId: fixtureB.team.id },
      { assignedToUserId: tenantB.userId }
    ]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/risk/findings/${fixtureA.finding.id}/assign`,
        headers: unsafeHeaders(tenantA),
        payload
      });
      assert.equal(response.statusCode, 400);
    }
    const after = await prisma.securityFinding.findUniqueOrThrow({ where: { id: fixtureA.finding.id } });
    assert.equal(after.ownerTeamId, before.ownerTeamId);
    assert.equal(after.assignedToUserId, before.assignedToUserId);
  });

  await t.test("authoritative availableActions match every workflow state", async () => {
    for (const [status, expectedActions] of Object.entries(workflowMatrix) as Array<
      [RiskWorkflowStatus, RiskWorkflowActionName[]]
    >) {
      await resetFinding(matrixFixture.finding.id, status, matrixFixture.team.id);
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/risk/findings/${matrixFixture.finding.id}`,
        headers: { cookie: tenantA.sessionCookie }
      });
      assert.equal(response.statusCode, 200, `${status}: ${response.body}`);
      assert.deepEqual(
        RiskFindingDetailDtoSchema.parse(response.json()).availableActions,
        expectedActions,
        status
      );
    }
  });

  await t.test("every allowed transition succeeds with atomic audit and false safety flags", async () => {
    for (const [status, actions] of Object.entries(workflowMatrix) as Array<
      [RiskWorkflowStatus, RiskWorkflowActionName[]]
    >) {
      for (const action of actions) {
        await resetFinding(matrixFixture.finding.id, status, matrixFixture.team.id);
        const before = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
        const response = await invokeWorkflowAction(
          app,
          tenantA,
          matrixFixture.finding.id,
          action,
          matrixFixture.team.id
        );
        assert.equal(response.statusCode, 200, `${status} -> ${action}: ${response.body}`);
        const result = RiskWorkflowActionDtoSchema.parse(response.json());
        assert.equal(result.awsApiCallExecuted, false);
        assert.equal(result.mutationExecuted, false);
        assert.equal(result.remediationExecuted, false);
        const after = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
        assert.equal(after.auditEvents, before.auditEvents + 1, `${status} -> ${action}`);
          assert.equal(
            after.riskAcceptances,
            before.riskAcceptances + (action === "accept-risk" ? 1 : 0),
            `${status} -> ${action}`
          );
          assert.equal(after.evidenceSnapshots, before.evidenceSnapshots, `${status} -> ${action}`);
      }
    }
  });

  await t.test("every disallowed transition returns 409 without side effects", async () => {
    for (const [status, allowedActions] of Object.entries(workflowMatrix) as Array<
      [RiskWorkflowStatus, RiskWorkflowActionName[]]
    >) {
      for (const action of workflowActions.filter((item) => !allowedActions.includes(item))) {
        await resetFinding(matrixFixture.finding.id, status, matrixFixture.team.id);
        const before = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
        const response = await invokeWorkflowAction(
          app,
          tenantA,
          matrixFixture.finding.id,
          action,
          matrixFixture.team.id
        );
        assert.equal(response.statusCode, 409, `${status} -> ${action}: ${response.body}`);
        assert.deepEqual(
          await stateCounts(tenantA.orgId, matrixFixture.finding.id),
          before,
          `${status} -> ${action}`
        );
      }
    }
  });

  await t.test("concurrent stale transitions allow one winner", async () => {
    await resetFinding(matrixFixture.finding.id, "OPEN", matrixFixture.team.id);
    const before = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
    const responses = await Promise.all([
      invokeWorkflowAction(app, tenantA, matrixFixture.finding.id, "acknowledge", matrixFixture.team.id),
      invokeWorkflowAction(app, tenantA, matrixFixture.finding.id, "acknowledge", matrixFixture.team.id)
    ]);
    assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);
    const after = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
    assert.equal(after.workflowStatus, "ACKNOWLEDGED");
    assert.equal(after.auditEvents, before.auditEvents + 1);
  });

  await t.test("concurrent same-state actions also allow one winner", async () => {
    await resetFinding(matrixFixture.finding.id, "ASSIGNED", matrixFixture.team.id);
    const before = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
    const responses = await Promise.all([
      invokeWorkflowAction(app, tenantA, matrixFixture.finding.id, "assign", matrixFixture.team.id),
      invokeWorkflowAction(app, tenantA, matrixFixture.finding.id, "accept-risk", matrixFixture.team.id)
    ]);
    assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);
    const after = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
    assert.equal(after.auditEvents, before.auditEvents + 1);
    assert.equal(after.riskAcceptances <= 1, true);
  });

  await t.test("assignment requires an owner team or assigned user", async () => {
    await resetFinding(matrixFixture.finding.id, "OPEN", matrixFixture.team.id);
    const before = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${matrixFixture.finding.id}/assign`,
      headers: unsafeHeaders(tenantA),
      payload: { priority: "P1" }
    });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(await stateCounts(tenantA.orgId, matrixFixture.finding.id), before);
  });

  await t.test("risk acceptance requires a current owner", async () => {
    await resetFinding(matrixFixture.finding.id, "ACKNOWLEDGED", null);
    const before = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
    const response = await invokeWorkflowAction(
      app,
      tenantA,
      matrixFixture.finding.id,
      "accept-risk",
      matrixFixture.team.id
    );
    assert.equal(response.statusCode, 409);
    assert.deepEqual(await stateCounts(tenantA.orgId, matrixFixture.finding.id), before);
  });

  await t.test("risk acceptance requires a future expiration", async () => {
    await resetFinding(matrixFixture.finding.id, "ACKNOWLEDGED", matrixFixture.team.id);
    const before = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${matrixFixture.finding.id}/accept-risk`,
      headers: unsafeHeaders(tenantA),
      payload: {
        riskAcceptanceReason: "Approved business exception",
        riskAcceptedUntil: new Date(Date.now() - 86_400_000).toISOString()
      }
    });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(await stateCounts(tenantA.orgId, matrixFixture.finding.id), before);
  });

  await t.test("risk acceptance links latest evidence and registry remains tenant-safe", async () => {
    await resetFinding(fixtureA.finding.id, "ACKNOWLEDGED", fixtureA.team.id);
    const older = await createEvidenceSnapshot(
      tenantA.orgId,
      fixtureA.finding.id,
      fixtureA.resource.id,
      new Date("2026-01-01T00:00:00.000Z")
    );
    const current = await createEvidenceSnapshot(
      tenantA.orgId,
      fixtureA.finding.id,
      fixtureA.resource.id,
      new Date("2026-02-01T00:00:00.000Z")
    );

    const accepted = await invokeWorkflowAction(
      app,
      tenantA,
      fixtureA.finding.id,
      "accept-risk",
      fixtureA.team.id
    );
    assert.equal(accepted.statusCode, 200, accepted.body);
    const acceptance = await prisma.riskAcceptance.findFirstOrThrow({
      where: {
        organizationId: tenantA.orgId,
        securityFindingId: fixtureA.finding.id
      },
      orderBy: { createdAt: "desc" }
    });
    assert.equal(acceptance.evidenceSnapshotId, current.id);
    assert.notEqual(acceptance.evidenceSnapshotId, older.id);

    const later = await createEvidenceSnapshot(
      tenantA.orgId,
      fixtureA.finding.id,
      fixtureA.resource.id,
      new Date("2026-03-01T00:00:00.000Z")
    );
    assert.notEqual(later.id, current.id);
    assert.equal(
      (await prisma.riskAcceptance.findUniqueOrThrow({
        where: { id: acceptance.id }
      })).evidenceSnapshotId,
      current.id
    );

    const registryResponse = await app.inject({
      method: "GET",
      url: "/api/v1/risk/acceptances?limit=1",
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(registryResponse.statusCode, 200, registryResponse.body);
    const registry = RiskAcceptanceRegistryResponseSchema.parse(
      registryResponse.json()
    );
    const item = registry.items.find(
      (entry) => entry.riskAcceptanceId === acceptance.id
    );
    assert.equal(item?.evidenceSnapshotId, current.id);
    assert.equal(item?.evidenceRuleId, "SG_OPEN_SSH_TO_WORLD");
    assert.equal(item?.evidenceRuleVersion, "1");
    assert.equal(item?.findingSource, "RULE_ENGINE");
    assert.equal(item?.resourceSource, "SAMPLE");
    assert.equal(item?.sampleData, true);
    assert.equal("evidence" in (item ?? {}), false);
    assert.equal("resourceSnapshot" in (item ?? {}), false);
    assert.equal("evaluationContext" in (item ?? {}), false);

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/risk/acceptances"
    });
    assert.equal(unauthenticated.statusCode, 401);

    const tenantBRegistry = await app.inject({
      method: "GET",
      url: "/api/v1/risk/acceptances",
      headers: { cookie: tenantB.sessionCookie }
    });
    assert.equal(tenantBRegistry.statusCode, 200, tenantBRegistry.body);
    assert.equal(
      RiskAcceptanceRegistryResponseSchema.parse(tenantBRegistry.json()).items
        .some((entry) => entry.riskAcceptanceId === acceptance.id),
      false
    );

    await setRole(tenantA, "NO_ACCESS");
    const forbidden = await app.inject({
      method: "GET",
      url: "/api/v1/risk/acceptances",
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(forbidden.statusCode, 403);
    await setRole(tenantA, "OWNER");

    const acceptanceCount = await prisma.riskAcceptance.count({
      where: { id: acceptance.id }
    });
    const reopened = await invokeWorkflowAction(
      app,
      tenantA,
      fixtureA.finding.id,
      "reopen",
      fixtureA.team.id
    );
    assert.equal(reopened.statusCode, 200, reopened.body);
    assert.equal(
      await prisma.riskAcceptance.count({ where: { id: acceptance.id } }),
      acceptanceCount
    );
  });

  await t.test("registry expiry classification and filters are deterministic", async () => {
    const now = new Date("2026-06-21T12:00:00.000Z");
    await prisma.riskAcceptance.createMany({
      data: [
        {
          organizationId: tenantA.orgId,
          securityFindingId: matrixFixture.finding.id,
          businessJustification: "Expired exception",
          approver: tenantA.userId,
          owner: fixtureA.team.name,
          ownerTeamId: fixtureA.team.id,
          expiresAt: new Date("2026-06-20T12:00:00.000Z")
        },
        {
          organizationId: tenantA.orgId,
          securityFindingId: matrixFixture.finding.id,
          businessJustification: "Expiring exception",
          approver: tenantA.userId,
          owner: fixtureA.team.name,
          ownerTeamId: fixtureA.team.id,
          expiresAt: new Date("2026-07-01T12:00:00.000Z")
        },
        {
          organizationId: tenantA.orgId,
          securityFindingId: matrixFixture.finding.id,
          businessJustification: "Active exception",
          approver: tenantA.userId,
          owner: fixtureA.team.name,
          ownerTeamId: fixtureA.team.id,
          expiresAt: new Date("2026-08-21T12:00:00.000Z")
        }
      ]
    });

    const all = await listRiskAcceptances(
      tenantA.orgId,
      { status: "all", limit: 50 },
      now
    );
    const byJustification = new Map(
      all.items.map((item) => [item.justification, item])
    );
    assert.equal(byJustification.get("Expired exception")?.expiryStatus, "EXPIRED");
    assert.equal(byJustification.get("Expiring exception")?.expiryStatus, "EXPIRING_SOON");
    assert.equal(byJustification.get("Active exception")?.expiryStatus, "ACTIVE");
    assert.equal(byJustification.get("Expired exception")?.daysUntilExpiry, -1);
    assert.equal(byJustification.get("Expiring exception")?.daysUntilExpiry, 10);
    assert.equal(byJustification.get("Active exception")?.daysUntilExpiry, 61);

    const firstPage = await listRiskAcceptances(
      tenantA.orgId,
      { status: "all", limit: 1 },
      now
    );
    assert.equal(firstPage.items.length, 1);
    assert.equal(firstPage.hasMore, true);
    assert.ok(firstPage.nextCursor);
    const secondPage = await listRiskAcceptances(
      tenantA.orgId,
      { status: "all", cursor: firstPage.nextCursor ?? undefined, limit: 1 },
      now
    );
    assert.equal(secondPage.items.length, 1);
    assert.notEqual(
      secondPage.items[0]?.riskAcceptanceId,
      firstPage.items[0]?.riskAcceptanceId
    );

    for (const [status, expected] of [
      ["expired", "Expired exception"],
      ["expiring-soon", "Expiring exception"],
      ["active", "Active exception"]
    ] as const) {
      const filtered = await listRiskAcceptances(
        tenantA.orgId,
        { status, severity: "HIGH", limit: 50 },
        now
      );
      assert.equal(
        filtered.items.some((item) => item.justification === expected),
        true
      );
      assert.equal(
        filtered.items.every((item) => item.expiryStatus === (
          status === "expired"
            ? "EXPIRED"
            : status === "active"
              ? "ACTIVE"
              : "EXPIRING_SOON"
        )),
        true
      );
    }
  });

  await t.test("repeated risk acceptance is rejected", async () => {
    await resetFinding(matrixFixture.finding.id, "ACKNOWLEDGED", matrixFixture.team.id);
    const first = await invokeWorkflowAction(
      app,
      tenantA,
      matrixFixture.finding.id,
      "accept-risk",
      matrixFixture.team.id
    );
    assert.equal(first.statusCode, 200, first.body);
    const beforeSecond = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
    const second = await invokeWorkflowAction(
      app,
      tenantA,
      matrixFixture.finding.id,
      "accept-risk",
      matrixFixture.team.id
    );
    assert.equal(second.statusCode, 409);
    assert.deepEqual(await stateCounts(tenantA.orgId, matrixFixture.finding.id), beforeSecond);
  });

  await t.test("reopen clears terminal and acceptance fields and records reopenedAt", async () => {
    const acceptedAt = new Date();
    await prisma.securityFinding.update({
      where: { id: matrixFixture.finding.id },
      data: {
        status: "RISK_ACCEPTED",
        workflowStatus: "RISK_ACCEPTED",
        ownerTeamId: matrixFixture.team.id,
        resolvedAt: acceptedAt,
        archivedAt: acceptedAt,
        riskAcceptedAt: acceptedAt,
        riskAcceptedUntil: futureDate(),
        riskAcceptedByUserId: tenantA.userId,
        riskAcceptanceReason: "Temporary approved exception"
      }
    });
    const response = await invokeWorkflowAction(
      app,
      tenantA,
      matrixFixture.finding.id,
      "reopen",
      matrixFixture.team.id
    );
    assert.equal(response.statusCode, 200, response.body);
    const finding = await prisma.securityFinding.findUniqueOrThrow({
      where: { id: matrixFixture.finding.id }
    });
    assert.equal(finding.workflowStatus, "REOPENED");
    assert.ok(finding.reopenedAt);
    assert.equal(finding.resolvedAt, null);
    assert.equal(finding.archivedAt, null);
    assert.equal(finding.riskAcceptedAt, null);
    assert.equal(finding.riskAcceptedUntil, null);
    assert.equal(finding.riskAcceptedByUserId, null);
    assert.equal(finding.riskAcceptanceReason, null);
  });

  await t.test("audit metadata is bounded and sanitized", async () => {
    await resetFinding(matrixFixture.finding.id, "OPEN", matrixFixture.team.id);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${matrixFixture.finding.id}/acknowledge`,
      headers: unsafeHeaders(tenantA),
      payload: { note: "provider error at handler (provider.ts:12:4)" }
    });
    assert.equal(response.statusCode, 200, response.body);
    const result = RiskWorkflowActionDtoSchema.parse(response.json());
    assert.equal(result.auditEvent.metadata.action, "acknowledge");
    assert.equal(result.auditEvent.metadata.fromStatus, "OPEN");
    assert.equal(result.auditEvent.metadata.toStatus, "ACKNOWLEDGED");
    assert.equal(result.auditEvent.metadata.note, "[redacted]");
  });

  await t.test("audit write failure rolls back finding update", async () => {
    await resetFinding(matrixFixture.finding.id, "OPEN", matrixFixture.team.id);
    const before = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
    await withFailingInsertTrigger("AuditEvent", "targetId", matrixFixture.finding.id, async () => {
      const response = await invokeWorkflowAction(
        app,
        tenantA,
        matrixFixture.finding.id,
        "acknowledge",
        matrixFixture.team.id
      );
      assert.equal(response.statusCode, 500);
    });
    assert.deepEqual(await stateCounts(tenantA.orgId, matrixFixture.finding.id), before);
  });

  await t.test("risk acceptance write failure rolls back finding and audit writes", async () => {
    await resetFinding(matrixFixture.finding.id, "ACKNOWLEDGED", matrixFixture.team.id);
    const before = await stateCounts(tenantA.orgId, matrixFixture.finding.id);
    await withFailingInsertTrigger(
      "RiskAcceptance",
      "securityFindingId",
      matrixFixture.finding.id,
      async () => {
        const response = await invokeWorkflowAction(
          app,
          tenantA,
          matrixFixture.finding.id,
          "accept-risk",
          matrixFixture.team.id
        );
        assert.equal(response.statusCode, 500);
      }
    );
    assert.deepEqual(await stateCounts(tenantA.orgId, matrixFixture.finding.id), before);
  });
});

async function createFindingFixture(session: Session, label: string) {
  const team = await prisma.team.create({
    data: {
      organizationId: session.orgId,
      name: `${label} Security`
    }
  });
  const account = await prisma.awsAccount.create({
    data: {
      organizationId: session.orgId,
      name: `${label} account`,
      accountId: uniqueAccountId(),
      environment: Environment.sandbox,
      status: AwsAccountStatus.CONNECTED,
      connectionStatus: "VALIDATION_SUCCEEDED",
      regions: ["us-east-1"]
    }
  });
  const resource = await prisma.cloudResource.create({
    data: {
      organizationId: session.orgId,
      awsAccountId: account.id,
      resourceType: "security-group",
      resourceId: `sg-${randomUUID()}`,
      name: `${label} sample security group`,
      region: "us-east-1",
      status: "active",
      source: "SAMPLE",
      metadata: { inboundRules: [{ port: 22, cidr: "0.0.0.0/0" }], sampleData: true }
    }
  });
  const finding = await prisma.securityFinding.create({
    data: {
      organizationId: session.orgId,
      awsAccountId: account.id,
      resourceId: resource.id,
      ruleId: "SG_OPEN_SSH_TO_WORLD",
      title: `${label} finding`,
      description: "Stored inventory finding for risk workflow tests.",
      severity: "HIGH",
      status: "OPEN",
      workflowStatus: "OPEN",
      evidence: { checked: true, sampleData: true, resourceSource: "SAMPLE" },
      source: "RULE_ENGINE",
      complianceRefs: ["Internal control"],
      ownerTeamId: team.id
    }
  });
  return { account, finding, resource, team };
}

async function stateCounts(organizationId: string, findingId: string) {
  const finding = await prisma.securityFinding.findUniqueOrThrow({ where: { id: findingId } });
  return {
    status: finding.status,
    workflowStatus: finding.workflowStatus,
    auditEvents: await prisma.auditEvent.count({ where: { organizationId, targetId: findingId } }),
      riskAcceptances: await prisma.riskAcceptance.count({ where: { organizationId, securityFindingId: findingId } }),
      evidenceSnapshots: await prisma.securityFindingEvidenceSnapshot.count({
        where: { organizationId, securityFindingId: findingId }
      })
  };
}

async function createEvidenceSnapshot(
  organizationId: string,
  securityFindingId: string,
  resourceId: string,
  capturedAt: Date
) {
  return prisma.securityFindingEvidenceSnapshot.create({
    data: {
      organizationId,
      securityFindingId,
      resourceId,
      ruleId: "SG_OPEN_SSH_TO_WORLD",
      ruleVersion: "1",
      schemaVersion: 1,
      evaluationMode: "STORED_INVENTORY",
      findingSource: "RULE_ENGINE",
      resourceSource: "SAMPLE",
      sampleData: true,
      title: "Stored inventory finding",
      summary: "Immutable test evidence.",
      resourceSnapshot: { resourceId, source: "SAMPLE" },
      evaluationContext: { resultStatus: "finding_updated" },
      capturedAt
    }
  });
}

async function registerTenant(app: Awaited<ReturnType<typeof buildApp>>, label: string): Promise<Session> {
  const csrfResponse = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const csrfCookie = csrfResponse.cookies.find((cookie) => cookie.name === "_csrf")?.value;
  const registerResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { "x-csrf-token": csrfResponse.json().token, cookie: `_csrf=${csrfCookie}` },
    payload: {
      name: `${label} Owner`,
      email: `${label}-${randomUUID()}@example.com`,
      organization: `${label} Organization`,
      password: "Password123!",
      confirmPassword: "Password123!"
    }
  });
  assert.equal(registerResponse.statusCode, 200, registerResponse.body);
  const session = registerResponse.cookies.find((cookie) => cookie.name === "cloudshield_session")?.value;
  assert.ok(session);
  let sessionCookie = `_csrf=${csrfCookie}; cloudshield_session=${session}`;
  const nextCsrf = await app.inject({
    method: "GET",
    url: "/api/v1/auth/csrf",
    headers: { cookie: sessionCookie }
  });
  const nextCsrfCookie = nextCsrf.cookies.find((cookie) => cookie.name === "_csrf")?.value;
  if (nextCsrfCookie) sessionCookie = `_csrf=${nextCsrfCookie}; cloudshield_session=${session}`;
  return {
    csrfToken: nextCsrf.json().token,
    sessionCookie,
    orgId: registerResponse.json().organization.id,
    userId: registerResponse.json().user.id
  };
}

async function setRole(session: Session, role: string) {
  await prisma.user.update({ where: { id: session.userId }, data: { role } });
  await prisma.organizationMembership.updateMany({
    where: { organizationId: session.orgId, userId: session.userId },
    data: { role, status: "ACTIVE" }
  });
}

function unsafeHeaders(session: Session) {
  return { cookie: session.sessionCookie, "x-csrf-token": session.csrfToken };
}

function futureDate() {
  return new Date(Date.now() + 86_400_000).toISOString();
}

async function resetFinding(
  findingId: string,
  status: RiskWorkflowStatus,
  ownerTeamId: string | null
) {
  await prisma.auditEvent.deleteMany({ where: { targetId: findingId } });
  await prisma.riskAcceptance.deleteMany({ where: { securityFindingId: findingId } });
  await prisma.securityFinding.update({
    where: { id: findingId },
    data: {
      status,
      workflowStatus: status,
      ownerTeamId,
      assignedToUserId: null,
      remediationPlan: null,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
      archivedAt: status === "ARCHIVED" ? new Date() : null,
      reopenedAt: status === "REOPENED" ? new Date() : null,
      riskAcceptedAt: status === "RISK_ACCEPTED" ? new Date() : null,
      riskAcceptedUntil: status === "RISK_ACCEPTED" ? futureDate() : null,
      riskAcceptedByUserId: null,
      riskAcceptanceReason: status === "RISK_ACCEPTED" ? "Existing accepted risk" : null
    }
  });
}

function actionPayload(action: RiskWorkflowActionName, teamId: string) {
  switch (action) {
    case "acknowledge":
      return { note: "Reviewed" };
    case "assign":
      return { ownerTeamId: teamId, priority: "P1" };
    case "plan-remediation":
      return { remediationPlan: "Review and prepare a safe manual change." };
    case "accept-risk":
      return {
        riskAcceptanceReason: "Approved business exception",
        riskAcceptedUntil: futureDate()
      };
    case "false-positive":
      return { reason: "Reviewed evidence does not apply." };
    case "resolve":
      return { resolutionNote: "Verified resolved." };
    case "archive":
      return { archiveReason: "Retained for audit." };
    case "reopen":
      return { reason: "Renewed review." };
  }
}

function invokeWorkflowAction(
  app: Awaited<ReturnType<typeof buildApp>>,
  session: Session,
  findingId: string,
  action: RiskWorkflowActionName,
  teamId: string
) {
  return app.inject({
    method: "POST",
    url: `/api/v1/risk/findings/${findingId}/${action}`,
    headers: unsafeHeaders(session),
    payload: actionPayload(action, teamId)
  });
}

async function withFailingInsertTrigger(
  table: "AuditEvent" | "RiskAcceptance",
  column: "targetId" | "securityFindingId",
  value: string,
  operation: () => Promise<void>
) {
  const suffix = randomUUID().replaceAll("-", "");
  const functionName = `cloudshield_test_fail_${suffix}`;
  const triggerName = `cloudshield_test_trigger_${suffix}`;
  const safeValue = value.replaceAll("'", "''");
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced workflow persistence failure'; END; $$ LANGUAGE plpgsql`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "${table}" FOR EACH ROW WHEN (NEW."${column}" = '${safeValue}') EXECUTE FUNCTION "${functionName}"()`
  );
  try {
    await operation();
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "${table}"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
  }
}

function uniqueAccountId() {
  return String(Math.floor(100_000_000_000 + Math.random() * 899_999_999_999));
}
