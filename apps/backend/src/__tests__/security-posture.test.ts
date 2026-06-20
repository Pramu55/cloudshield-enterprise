import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import {
  AwsAccountStatus,
  Environment,
  evaluateSecurityRules,
  prisma
} from "@cloudshield/database";
import {
  SecurityEvaluationResponseSchema,
  SecurityFindingsResponseSchema
} from "@cloudshield/contracts";
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

test("security posture evaluates stored inventory with scoped provenance", async (t) => {
  const app = await buildApp();
  const owner = await registerTenant(app, "security-posture");

  t.after(async () => {
    await prisma.organization.delete({ where: { id: owner.orgId } }).catch(() => undefined);
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close(),
      securityMonitoringQueue.close()
    ]);
    await prisma.$disconnect();
  });

  const account = await prisma.awsAccount.create({
    data: {
      organizationId: owner.orgId,
      name: "Stored inventory account",
      accountId: uniqueAccountId(),
      environment: Environment.sandbox,
      status: AwsAccountStatus.CONNECTED,
      connectionStatus: "VALIDATION_SUCCEEDED",
      regions: ["us-east-1"]
    }
  });

  const sampleResource = await prisma.cloudResource.create({
    data: {
      organizationId: owner.orgId,
      awsAccountId: account.id,
      resourceType: "security-group",
      resourceId: `sg-sample-${randomUUID()}`,
      name: "Sample open SSH",
      region: "us-east-1",
      status: "active",
      tags: { owner: "security", environment: "test" },
      metadata: { inboundRules: [{ port: 22, cidr: "0.0.0.0/0" }] },
      source: "SAMPLE"
    }
  });
  const awsResource = await prisma.cloudResource.create({
    data: {
      organizationId: owner.orgId,
      awsAccountId: account.id,
      resourceType: "ebs-volume",
      resourceId: `vol-aws-${randomUUID()}`,
      name: "AWS unencrypted volume",
      region: "us-east-1",
      status: "in-use",
      tags: { owner: "platform", environment: "test" },
      metadata: { encrypted: false, attachments: [{ id: "i-test" }] },
      source: "AWS_SYNC"
    }
  });
  const archivedResource = await prisma.cloudResource.create({
    data: {
      organizationId: owner.orgId,
      awsAccountId: account.id,
      resourceType: "security-group",
      resourceId: `sg-archived-${randomUUID()}`,
      name: "Archived open RDP",
      region: "us-east-1",
      status: "active",
      tags: { owner: "security", environment: "test" },
      metadata: { inboundRules: [{ port: 3389, cidr: "0.0.0.0/0" }] },
      source: "SAMPLE",
      archivedAt: new Date()
    }
  });

  await t.test("creates findings from stored non-archived resources", async () => {
    const expectedResourceCount = await prisma.cloudResource.count({
      where: { organizationId: owner.orgId, archivedAt: null }
    });
    const summary = await evaluateSecurityRules(owner.orgId);
    assert.equal(summary.evaluatedResourceCount, expectedResourceCount);

    const sampleFinding = await prisma.securityFinding.findFirstOrThrow({
      where: {
        organizationId: owner.orgId,
        resourceId: sampleResource.id,
        ruleId: "SG_OPEN_SSH_TO_WORLD",
        source: "RULE_ENGINE"
      }
    });
    const awsFinding = await prisma.securityFinding.findFirstOrThrow({
      where: {
        organizationId: owner.orgId,
        resourceId: awsResource.id,
        ruleId: "EBS_UNENCRYPTED",
        source: "RULE_ENGINE"
      }
    });

    assert.equal((sampleFinding.evidence as Record<string, unknown>).resourceSource, "SAMPLE");
    assert.equal((sampleFinding.evidence as Record<string, unknown>).sampleData, true);
    assert.equal((awsFinding.evidence as Record<string, unknown>).resourceSource, "AWS_SYNC");
    assert.equal((awsFinding.evidence as Record<string, unknown>).sampleData, false);
    assert.equal(
      await prisma.securityFinding.count({
        where: { organizationId: owner.orgId, resourceId: archivedResource.id }
      }),
      0
    );
  });

  await t.test("updates idempotently instead of duplicating", async () => {
    const before = await prisma.securityFinding.count({
      where: {
        organizationId: owner.orgId,
        resourceId: sampleResource.id,
        ruleId: "SG_OPEN_SSH_TO_WORLD",
        source: "RULE_ENGINE"
      }
    });
    const summary = await evaluateSecurityRules(owner.orgId);
    const after = await prisma.securityFinding.count({
      where: {
        organizationId: owner.orgId,
        resourceId: sampleResource.id,
        ruleId: "SG_OPEN_SSH_TO_WORLD",
        source: "RULE_ENGINE"
      }
    });

    assert.equal(before, 1);
    assert.equal(after, 1);
    assert.ok(summary.findingsUpdated > 0);
  });

  await t.test("resolves only in-scope rule-engine findings", async () => {
    const manualFinding = await prisma.securityFinding.create({
      data: {
        organizationId: owner.orgId,
        awsAccountId: account.id,
        resourceId: sampleResource.id,
        ruleId: "SG_OPEN_SSH_TO_WORLD",
        title: "Manual review finding",
        description: "Must not be resolved by the deterministic engine.",
        severity: "HIGH",
        status: "OPEN",
        workflowStatus: "OPEN",
        evidence: {},
        source: "MANUAL",
        complianceRefs: []
      }
    });
    const archivedFinding = await prisma.securityFinding.create({
      data: {
        organizationId: owner.orgId,
        awsAccountId: account.id,
        resourceId: archivedResource.id,
        ruleId: "SG_OPEN_RDP_TO_WORLD",
        title: "Archived resource finding",
        description: "Outside the current evaluation scope.",
        severity: "HIGH",
        status: "OPEN",
        workflowStatus: "OPEN",
        evidence: {},
        source: "RULE_ENGINE",
        complianceRefs: []
      }
    });

    await prisma.cloudResource.update({
      where: { id: sampleResource.id },
      data: { metadata: { inboundRules: [] } }
    });
    await evaluateSecurityRules(owner.orgId);

    const resolved = await prisma.securityFinding.findFirstOrThrow({
      where: {
        organizationId: owner.orgId,
        resourceId: sampleResource.id,
        ruleId: "SG_OPEN_SSH_TO_WORLD",
        source: "RULE_ENGINE"
      }
    });
    assert.equal(resolved.status, "RESOLVED");
    assert.equal(resolved.workflowStatus, "RESOLVED");
    assert.ok(resolved.resolvedAt);
    assert.equal((await prisma.securityFinding.findUniqueOrThrow({ where: { id: manualFinding.id } })).status, "OPEN");
    assert.equal((await prisma.securityFinding.findUniqueOrThrow({ where: { id: archivedFinding.id } })).status, "OPEN");
  });

  await t.test("maps SAMPLE and AWS_SYNC provenance distinctly", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/security/findings",
      headers: { cookie: owner.sessionCookie }
    });

    assert.equal(response.statusCode, 200, response.body);
    const body = SecurityFindingsResponseSchema.parse(response.json());
    const sampleFinding = body.items.find(
      (item) => item.resourceId === sampleResource.id && item.findingSource === "RULE_ENGINE"
    );
    const awsFinding = body.items.find(
      (item) => item.resourceId === awsResource.id && item.findingSource === "RULE_ENGINE"
    );
    assert.equal(sampleFinding?.findingSource, "RULE_ENGINE");
    assert.equal(sampleFinding?.resourceSource, "SAMPLE");
    assert.equal(sampleFinding?.sampleData, true);
    assert.equal(awsFinding?.findingSource, "RULE_ENGINE");
    assert.equal(awsFinding?.resourceSource, "AWS_SYNC");
    assert.equal(awsFinding?.sampleData, false);
    assert.equal(body.sampleData, true);
  });

  await t.test("enforces authentication, capability, CSRF, and strict request body", async () => {
    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/security/findings"
    });
    assert.equal(unauthenticated.statusCode, 401);

    const missingCsrf = await app.inject({
      method: "POST",
      url: "/api/v1/security/evaluate",
      headers: { cookie: owner.sessionCookie },
      payload: {}
    });
    assert.equal(missingCsrf.statusCode, 403);

    const invalidBody = await app.inject({
      method: "POST",
      url: "/api/v1/security/evaluate",
      headers: unsafeHeaders(owner),
      payload: { organizationId: "caller-controlled-tenant" }
    });
    assert.equal(invalidBody.statusCode, 400);

    await setRole(owner, "VIEWER");
    const readable = await app.inject({
      method: "GET",
      url: "/api/v1/security/findings",
      headers: { cookie: owner.sessionCookie }
    });
    assert.equal(readable.statusCode, 200);
    const forbidden = await app.inject({
      method: "POST",
      url: "/api/v1/security/evaluate",
      headers: unsafeHeaders(owner),
      payload: {}
    });
    assert.equal(forbidden.statusCode, 403);

    await setRole(owner, "OWNER");
    const evaluated = await app.inject({
      method: "POST",
      url: "/api/v1/security/evaluate",
      headers: unsafeHeaders(owner),
      payload: {}
    });
    assert.equal(evaluated.statusCode, 200, evaluated.body);
    const evaluation = SecurityEvaluationResponseSchema.parse(evaluated.json());
    assert.equal(evaluation.evaluationMode, "STORED_INVENTORY");
    assert.equal(evaluation.awsApiCallExecuted, false);
    assert.equal(evaluation.mutationExecuted, false);
  });
});

async function registerTenant(
  app: Awaited<ReturnType<typeof buildApp>>,
  label: string
): Promise<Session> {
  const csrfResponse = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const csrfCookie = csrfResponse.cookies.find((cookie) => cookie.name === "_csrf")?.value;
  const registerResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: {
      "x-csrf-token": csrfResponse.json().token,
      cookie: `_csrf=${csrfCookie}`
    },
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
  if (nextCsrfCookie) {
    sessionCookie = `_csrf=${nextCsrfCookie}; cloudshield_session=${session}`;
  }

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
  return {
    cookie: session.sessionCookie,
    "x-csrf-token": session.csrfToken
  };
}

function uniqueAccountId() {
  return String(Math.floor(100_000_000_000 + Math.random() * 899_999_999_999));
}
