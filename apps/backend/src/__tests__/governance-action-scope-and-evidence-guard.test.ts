import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { prisma, type Prisma } from "@cloudshield/database";

type Session = {
  csrfToken: string;
  sessionCookie: string;
  orgId: string;
  userId: string;
};

test("Governance Action Scope and Evidence Guard", async (t) => {
  process.env.AWS_CONNECTOR_MODE = "disabled";
  process.env.AWS_INVENTORY_SCANNER_MODE = "disabled";
  process.env.AWS_CHANGE_EXECUTION_MODE = "simulation";

  const app = await buildApp();
  const createdOrgIds: string[] = [];

  t.after(async () => {
    await cleanupTestOrganizations(createdOrgIds);
    await app.close();
    await prisma.$disconnect();
  });

  const tenantA = await registerTenant(app, "gov-guard-a");
  const tenantB = await registerTenant(app, "gov-guard-b");
  createdOrgIds.push(tenantA.orgId, tenantB.orgId);

  // Setup Accounts
  const activeAccount = await createAccount(tenantA.orgId, "active-account", "VALIDATION_SUCCEEDED");
  const archivedAccount = await createAccount(tenantA.orgId, "archived-account", "VALIDATION_SUCCEEDED", new Date());
  const disabledAccount = await createAccount(tenantA.orgId, "disabled-account", "DISABLED");
  const crossTenantAccount = await createAccount(tenantB.orgId, "active-account-b", "VALIDATION_SUCCEEDED");

  // Setup Findings
  const activeFinding = await createFinding(tenantA.orgId, activeAccount.id, null, "Active Finding", "CRITICAL");
  const activeFinding2 = await createFinding(tenantA.orgId, activeAccount.id, null, "Active Finding 2", "HIGH");
  const archivedFinding = await createFinding(tenantA.orgId, archivedAccount.id, null, "Archived Finding", "HIGH");
  const disabledFinding = await createFinding(tenantA.orgId, disabledAccount.id, null, "Disabled Finding", "MEDIUM");
  const crossTenantFinding = await createFinding(tenantB.orgId, crossTenantAccount.id, null, "Cross Tenant", "LOW");

  // ─── Risk Workflow Guards ────────────────────────────────────────────

  await t.test("Cross-tenant risk target is blocked (returns 404)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${crossTenantFinding.id}/acknowledge`,
      headers: sessionHeaders(tenantA),
      payload: { justification: "test" }
    });
    assert.equal(res.statusCode, 404);
  });

  await t.test("Archived account finding cannot be risk-workflow mutated", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${archivedFinding.id}/acknowledge`,
      headers: sessionHeaders(tenantA),
      payload: { justification: "test" }
    });
    assert.equal(res.statusCode, 409, `Expected 409, got ${res.statusCode}: ${res.body}`);
    assert.equal(res.json().classification, "aws_account_lifecycle_blocked");
  });

  await t.test("Disabled account finding cannot be risk-workflow mutated", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${disabledFinding.id}/acknowledge`,
      headers: sessionHeaders(tenantA),
      payload: { justification: "test" }
    });
    assert.equal(res.statusCode, 409, `Expected 409, got ${res.statusCode}: ${res.body}`);
    assert.equal(res.json().classification, "aws_account_lifecycle_blocked");
  });

  // ─── Remediation Plan Guards ─────────────────────────────────────────

  await t.test("Archived account finding cannot create remediation plan", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/findings/${archivedFinding.id}/remediation-plans`,
      headers: sessionHeaders(tenantA),
      payload: { implementationMode: "MANUAL" }
    });
    assert.equal(res.statusCode, 409, `Expected 409, got ${res.statusCode}: ${res.body}`);
    assert.equal(res.json().classification, "aws_account_lifecycle_blocked");
  });

  await t.test("Active account finding CAN create remediation plan", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/findings/${activeFinding.id}/remediation-plans`,
      headers: sessionHeaders(tenantA),
      payload: { implementationMode: "MANUAL" }
    });
    assert.equal(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${res.body}`);
  });

  // ─── Evidence Redaction ──────────────────────────────────────────────

  await t.test("Evidence redaction: sanitizeGovernanceEvidencePayload recursively redacts secret-like fields", async () => {
    const { sanitizeGovernanceEvidencePayload } = await import("../modules/governance-action-guard/governance-action-guard.policy.js");

    const payload = {
      user: "test",
      secretValue: "my-secret-123",
      token: "xyz",
      nested: {
        accessKey: "AKIA...",
        safeData: "hello",
        rawProvider: {
          key: "value"
        }
      },
      arrayField: [
        { credential: "abc", name: "safe" }
      ]
    };

    const redacted = sanitizeGovernanceEvidencePayload(payload) as any;
    assert.equal(redacted.user, "test");
    assert.equal(redacted.secretValue, "[REDACTED]");
    assert.equal(redacted.token, "[REDACTED]");
    assert.equal(redacted.nested.accessKey, "[REDACTED]");
    assert.equal(redacted.nested.safeData, "hello");
    assert.equal(redacted.nested.rawProvider, "[REDACTED]");
    assert.equal(redacted.arrayField[0].credential, "[REDACTED]");
    assert.equal(redacted.arrayField[0].name, "safe");
  });

  await t.test("Evidence redaction: handles null, undefined, primitives gracefully", async () => {
    const { sanitizeGovernanceEvidencePayload } = await import("../modules/governance-action-guard/governance-action-guard.policy.js");

    assert.equal(sanitizeGovernanceEvidencePayload(null), null);
    assert.equal(sanitizeGovernanceEvidencePayload(undefined), undefined);
    assert.equal(sanitizeGovernanceEvidencePayload("hello"), "hello");
    assert.equal(sanitizeGovernanceEvidencePayload(42), 42);
    assert.equal(sanitizeGovernanceEvidencePayload(true), true);
  });

  await t.test("Evidence redaction: empty object and array pass through safely", async () => {
    const { sanitizeGovernanceEvidencePayload } = await import("../modules/governance-action-guard/governance-action-guard.policy.js");

    assert.deepStrictEqual(sanitizeGovernanceEvidencePayload({}), {});
    assert.deepStrictEqual(sanitizeGovernanceEvidencePayload([]), []);
  });

  // ─── Cross-tenant remediation isolation ──────────────────────────────

  await t.test("Cross-tenant finding cannot create remediation plan (returns 404)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/findings/${crossTenantFinding.id}/remediation-plans`,
      headers: sessionHeaders(tenantA),
      payload: { implementationMode: "MANUAL" }
    });
    assert.equal(res.statusCode, 404);
  });

  // ─── Active account risk workflow actions succeed ────────────────────

  await t.test("Active account finding CAN be acknowledged via risk workflow", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${activeFinding2.id}/acknowledge`,
      headers: sessionHeaders(tenantA),
      payload: { justification: "legitimate risk acknowledged" }
    });
    assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function uniqueAccountId() {
  // Generate a 12-digit numeric account ID from UUID hex chars
  const hex = randomUUID().replace(/-/g, "").slice(0, 12);
  return Array.from(hex).map(c => (parseInt(c, 16) % 10).toString()).join("");
}

async function createAccount(organizationId: string, name: string, connectionStatus: string, archivedAt?: Date) {
  return prisma.awsAccount.create({
    data: {
      organizationId,
      accountId: uniqueAccountId(),
      name,
      roleArnPlaceholder: `arn:aws:iam::123456789012:role/${name}`,
      connectionStatus: connectionStatus as any,
      status: "CONNECTED" as any,
      environment: "dev" as any,
      archivedAt: archivedAt || null
    }
  });
}

async function createFinding(organizationId: string, awsAccountId: string, resourceId: string | null, title: string, severity: string) {
  return prisma.securityFinding.create({
    data: {
      organizationId,
      awsAccountId,
      resourceId,
      ruleId: `test-${randomUUID()}`,
      title,
      description: "desc",
      severity: severity as any,
      status: "OPEN" as any,
      workflowStatus: "OPEN" as any,
      evidence: { safe: true } satisfies Prisma.InputJsonObject,
      source: "AWS_SYNC" as any,
      complianceRefs: [] satisfies Prisma.InputJsonArray
    }
  });
}

async function registerTenant(app: Awaited<ReturnType<typeof buildApp>>, label: string): Promise<Session> {
  const csrfRes = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const csrfCookie = csrfRes.cookies.find((cookie) => cookie.name === "_csrf")?.value;
  const email = `${label}-${Date.now()}-${randomUUID()}@example.com`;
  const registerRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { "x-csrf-token": csrfRes.json().token, cookie: `_csrf=${csrfCookie}` },
    payload: {
      name: `${label} Owner`,
      email,
      organization: `${label} Org`,
      password: "Password123!",
      confirmPassword: "Password123!"
    }
  });

  const session = registerRes.cookies.find((cookie) => cookie.name === "cloudshield_session")?.value;
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
    orgId: registerRes.json().organization.id,
    userId: registerRes.json().user.id
  };
}

function sessionHeaders(session: Session) {
  return {
    cookie: session.sessionCookie,
    "x-csrf-token": session.csrfToken
  };
}

async function cleanupTestOrganizations(organizationIds: string[]) {
  if (organizationIds.length === 0) return;
  const scopedWhere = { organizationId: { in: organizationIds } };

  await prisma.remediationPlan.deleteMany({ where: scopedWhere });
  await prisma.auditEvent.deleteMany({ where: scopedWhere });
  await prisma.approvalRequest.deleteMany({ where: scopedWhere });
  await prisma.securityFinding.deleteMany({ where: scopedWhere });
  await prisma.awsAccount.deleteMany({ where: scopedWhere });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
}
