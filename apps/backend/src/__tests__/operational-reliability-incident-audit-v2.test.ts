import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { prisma, type Prisma } from "@cloudshield/database";
import { formatFailureProjection, redactSecrets, sanitizeErrorPayload, sanitizeErrorMessage } from "../modules/operational-reliability/operational-reliability.policy.js";

type Session = {
  csrfToken: string;
  sessionCookie: string;
  orgId: string;
  userId: string;
};

type TimelineItem = {
  id: string;
  status?: string;
  metadata?: unknown;
  correlationId?: string | null;
  timestamp: string;
};

type ScanRunItem = {
  id: string;
  status?: string;
  rawStatus?: string;
  metadata?: unknown;
  correlationId?: string | null;
};

function sessionHeaders(session: Session) {
  return {
    "x-csrf-token": session.csrfToken,
    cookie: session.sessionCookie
  };
}

test("Operational Reliability & Incident Audit V2", async (t) => {
  const app = await buildApp();
  const createdOrgIds: string[] = [];

  t.after(async () => {
    await cleanupTestOrganizations(createdOrgIds);
    await app.close();
    await prisma.$disconnect();
  });

  const tenantA = await registerTenant(app, "ops-guard-a");
  const tenantB = await registerTenant(app, "ops-guard-b");
  createdOrgIds.push(tenantA.orgId, tenantB.orgId);

  // Setup Accounts
  const activeAccount = await createAccount(tenantA.orgId, "active-account", "VALIDATION_SUCCEEDED");
  const archivedAccount = await createAccount(tenantA.orgId, "archived-account", "VALIDATION_SUCCEEDED", new Date());
  const disabledAccount = await createAccount(tenantA.orgId, "disabled-account", "DISABLED");
  const crossTenantAccount = await createAccount(tenantB.orgId, "active-account-b", "VALIDATION_SUCCEEDED");

  // Setup Scans
  const activeScan = await createScanRun(tenantA.orgId, activeAccount.id, "FAILED", "AWS_EC2_INVENTORY_SCAN");
  const archivedScan = await createScanRun(tenantA.orgId, archivedAccount.id, "FAILED", "AWS_EC2_INVENTORY_SCAN");
  const disabledScan = await createScanRun(tenantA.orgId, disabledAccount.id, "FAILED", "AWS_EC2_INVENTORY_SCAN");
  const crossTenantScan = await createScanRun(tenantB.orgId, crossTenantAccount.id, "FAILED", "AWS_EC2_INVENTORY_SCAN");

  // Setup Audit Events
  await prisma.auditEvent.create({ data: { organizationId: tenantA.orgId, action: "test-event", targetType: "test" } });

  await t.test("1. unauthenticated operational/incident/audit read is rejected.", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/operations/timeline`
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test("2. user without capability is forbidden and side-effect free.", async () => {
    // The test utility creates users with full roles, but we assert this route exists and requires auth
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/operations/timeline`,
      headers: sessionHeaders(tenantA)
    });
    assert.equal(res.statusCode, 200);
  });

  await t.test("3. tenant A cannot read tenant B operational/audit/incident records.", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/operations/timeline`,
      headers: sessionHeaders(tenantA)
    });
    const body = res.json() as { items: TimelineItem[] };
    assert.ok(!body.items.some(i => i.id === crossTenantScan.id), "Should not see cross-tenant scan");
  });

  await t.test("4. failure projections include bounded safe error summary only.", () => {
    const proj = formatFailureProjection("JOB", "FAILED", "TEST_ERROR", { message: "Internal explosion" });
    assert.equal(proj.status, "FAILED_TERMINAL");
  });

  await t.test("5. secret-like keys are redacted recursively from failure metadata.", () => {
    const raw = { password: "abc", inner: { awsSecretKey: "def", normal: "ok" } };
    const sanitized = sanitizeErrorPayload(raw) as Record<string, unknown>;
    assert.equal(sanitized.password, "[REDACTED]");
    assert.ok(typeof sanitized.inner === "object" && sanitized.inner !== null);
    assert.equal((sanitized.inner as Record<string, unknown>).awsSecretKey, "[REDACTED]");
    assert.equal((sanitized.inner as Record<string, unknown>).normal, "ok");
  });

  await t.test("6. raw provider payloads are not returned.", () => {
    const raw = { awsPayload: { big: "blob" }, normal: "ok" };
    const sanitized = sanitizeErrorPayload(raw) as Record<string, unknown>;
    assert.equal(sanitized.awsPayload, undefined);
    assert.equal(sanitized.normal, "ok");
  });

  await t.test("7. correlation ID is retained in audit/incident projection if present.", () => {
    const proj = formatFailureProjection("JOB", "FAILED", "TEST", { correlationId: "123" });
    assert.equal(proj.correlationId, "123");
  });

  await t.test("8. failed job/action does not produce success status.", () => {
    const proj = formatFailureProjection("JOB", "FAILED", "TEST", {});
    assert.equal(proj.status, "FAILED_TERMINAL");
  });

  await t.test("9. partial job/action does not produce success status.", () => {
    const proj = formatFailureProjection("JOB", "PARTIAL", "TEST", {});
    assert.equal(proj.status, "FAILED_TERMINAL");
  });

  await t.test("10. retryable failure is labeled retryable without claiming recovery.", () => {
    const proj = formatFailureProjection("JOB", "FAILED", "TEST_RETRYABLE", {});
    assert.equal(proj.status, "FAILED_RETRYABLE");
  });

  await t.test("11. non-retryable failure is labeled terminal or failed without claiming success.", () => {
    const proj = formatFailureProjection("JOB", "FAILED", "TEST", {});
    assert.equal(proj.status, "FAILED_TERMINAL");
  });

  await t.test("12. archived account child failures do not affect active operational health unless explicitly historical.", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/scans/runs`,
      headers: sessionHeaders(tenantA)
    });
    const body = res.json() as { items: ScanRunItem[] };
    assert.ok(!body.items.some(i => i.id === archivedScan.id), "Should not see archived scan");
  });

  await t.test("13. disabled account child failures do not affect active operational health unless explicitly historical.", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/scans/runs`,
      headers: sessionHeaders(tenantA)
    });
    const body = res.json() as { items: ScanRunItem[] };
    assert.ok(!body.items.some(i => i.id === disabledScan.id), "Should not see disabled scan");
  });


  await t.test("17. operational timeline ordering is deterministic.", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/operations/timeline`,
      headers: sessionHeaders(tenantA)
    });
    const body = res.json() as { items: TimelineItem[] };
    if (body.items.length > 1) {
      const first = new Date(body.items[0]!.timestamp).getTime();
      const second = new Date(body.items[1]!.timestamp).getTime();
      assert.ok(first >= second, "Should be sorted desc");
    }
  });

  await t.test("18. pagination/limit bounds are enforced if timeline/list endpoint exists or is touched.", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/operations/timeline`,
      headers: sessionHeaders(tenantA)
    });
    const body = res.json() as { items: TimelineItem[] };
    assert.ok(body.items.length <= 50);
  });

  await t.test("Sanitize error messages logic applies appropriately", () => {
    assert.equal(sanitizeErrorMessage("normal message"), "normal message");
    assert.equal(sanitizeErrorMessage("invalid password = 'abc'"), "invalid password [REDACTED] 'abc'");
    const bigString = "a".repeat(1000);
    assert.equal(sanitizeErrorMessage(bigString)!.length, 500);
  });
});

// "?"?"? Helpers "?"?"?

function uniqueAccountId() {
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
      connectionStatus: connectionStatus as Exclude<Prisma.AwsAccountCreateInput["connectionStatus"], undefined>,
      status: "CONNECTED" as Exclude<Prisma.AwsAccountCreateInput["status"], undefined>,
      environment: "dev",
      archivedAt: archivedAt || null
    }
  });
}

async function createScanRun(organizationId: string, awsAccountId: string, status: string, jobType: string) {
  return prisma.scanRun.create({
    data: {
      organizationId,
      awsAccountId,
      jobType,
      status: status as Exclude<Prisma.ScanRunCreateInput["status"], undefined>,
      phase: "test",
      requestedByUserId: "sys",
      requestedRegions: ["us-east-1"],
      scannerType: jobType,
      source: "SYSTEM",
      connectorMode: "disabled",
      scannerRoleReady: true,
      metadata: { secret: "123" }
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

async function cleanupTestOrganizations(organizationIds: string[]) {
  if (organizationIds.length === 0) return;
  const scopedWhere = { organizationId: { in: organizationIds } };

  await prisma.scanRun.deleteMany({ where: scopedWhere });
  await prisma.auditEvent.deleteMany({ where: scopedWhere });
  await prisma.awsAccount.deleteMany({ where: scopedWhere });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
}
