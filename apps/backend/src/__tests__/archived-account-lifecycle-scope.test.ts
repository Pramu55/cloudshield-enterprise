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

test("archived AWS accounts are blocked from operational workflows and excluded from active scopes", async (t) => {
  process.env.AWS_CONNECTOR_MODE = "disabled";
  process.env.AWS_INVENTORY_SCANNER_MODE = "disabled";
  process.env.AWS_CHANGE_EXECUTION_MODE = "disabled";

  const app = await buildApp();
  const createdOrgIds: string[] = [];

  t.after(async () => {
    await cleanupTestOrganizations(createdOrgIds);
    await app.close();
    await prisma.$disconnect();
  });

  const tenantA = await registerTenant(app, "archived-lifecycle-a");
  const tenantB = await registerTenant(app, "archived-lifecycle-b");
  createdOrgIds.push(tenantA.orgId, tenantB.orgId);

  const fixture = await seedArchivedLifecycleFixture(tenantA, tenantB);

  await t.test("default account list excludes archived account and keeps active account", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/aws/accounts",
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 200, res.body);
    const body = res.json() as { items: Array<{ id: string; name: string }> };
    const accountIds = body.items.map((item) => item.id);
    assert.ok(accountIds.includes(fixture.activeAccount.id));
    assert.equal(accountIds.includes(fixture.archivedAccount.id), false);
    assert.equal(accountIds.includes(fixture.otherTenantAccount.id), false);
  });

  await t.test("archived account detail remains tenant-scoped and exposes lifecycle state", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/aws/accounts/${fixture.archivedAccount.id}`,
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 200, res.body);
    const body = res.json() as { item: { id: string; archivedAt: string | null; connectionStatus: string } };
    assert.equal(body.item.id, fixture.archivedAccount.id);
    assert.equal(typeof body.item.archivedAt, "string");
    assert.equal(body.item.connectionStatus, "DISABLED");
  });

  await t.test("cross-tenant archived account remains hidden", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/aws/accounts/${fixture.otherTenantAccount.id}`,
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 404, res.body);
  });

  await t.test("archived account cannot run registry validation", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/aws/accounts/${fixture.archivedAccount.id}/validate`,
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 409, res.body);
    assert.equal((res.json() as { error: string }).error, "aws_account_lifecycle_blocked");
  });

  await t.test("archived account cannot run STS validate-identity before any AWS call", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/aws/accounts/${fixture.archivedAccount.id}/validate-identity`,
      headers: sessionHeaders(tenantA),
      payload: {}
    });

    assert.equal(res.statusCode, 409, res.body);
    const body = res.json() as { error: string; awsApiCallExecuted?: boolean };
    assert.equal(body.error, "aws_account_disabled");
    assert.equal(body.awsApiCallExecuted ?? false, false);
  });

  await t.test("archived account cannot trigger inventory sync or create scan records", async () => {
    const before = await prisma.scanRun.count({
      where: { organizationId: tenantA.orgId, awsAccountId: fixture.archivedAccount.id }
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/aws/accounts/${fixture.archivedAccount.id}/inventory/sync`,
      headers: sessionHeaders(tenantA),
      payload: {}
    });
    const after = await prisma.scanRun.count({
      where: { organizationId: tenantA.orgId, awsAccountId: fixture.archivedAccount.id }
    });

    assert.equal(res.statusCode, 409, res.body);
    assert.equal((res.json() as { error: string }).error, "aws_account_lifecycle_blocked");
    assert.equal(after, before);
  });

  await t.test("inventory default and archived account filters exclude archived parent resources", async () => {
    const defaultRes = await app.inject({
      method: "GET",
      url: "/api/v1/inventory/resources?limit=100",
      headers: sessionHeaders(tenantA)
    });
    assert.equal(defaultRes.statusCode, 200, defaultRes.body);
    const defaultResourceIds = resourceIds(defaultRes.json());
    assert.ok(defaultResourceIds.includes(fixture.activeResource.resourceId));
    assert.equal(defaultResourceIds.includes(fixture.archivedResource.resourceId), false);

    const archivedFilterRes = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/resources?accountId=${encodeURIComponent(fixture.archivedAccount.id)}&search=${encodeURIComponent(fixture.archivedResource.name ?? "")}&limit=100`,
      headers: sessionHeaders(tenantA)
    });
    assert.equal(archivedFilterRes.statusCode, 200, archivedFilterRes.body);
    assert.deepEqual(resourceIds(archivedFilterRes.json()), []);
  });

  await t.test("dashboard, organization, governance, and report summaries exclude archived account child data", async () => {
    const dashboard = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/summary",
      headers: sessionHeaders(tenantA)
    });
    assert.equal(dashboard.statusCode, 200, dashboard.body);
    const dashboardBody = dashboard.json() as {
      counts: { awsAccounts: number; resources: number; securityFindings: number; openRisks: number; highRiskFindings: number };
    };
    assert.equal(dashboardBody.counts.awsAccounts, 1);
    assert.equal(dashboardBody.counts.resources, 1);
    assert.equal(dashboardBody.counts.securityFindings, 1);
    assert.equal(dashboardBody.counts.openRisks, 1);
    assert.equal(dashboardBody.counts.highRiskFindings, 1);

    const overview = await app.inject({
      method: "GET",
      url: "/api/v1/organizations/overview",
      headers: sessionHeaders(tenantA)
    });
    assert.equal(overview.statusCode, 200, overview.body);
    assert.equal((overview.json() as { accountsCount: number }).accountsCount, 1);

    const governance = await app.inject({
      method: "GET",
      url: "/api/v1/governance/business-units",
      headers: sessionHeaders(tenantA)
    });
    assert.equal(governance.statusCode, 200, governance.body);
    const businessUnits = (governance.json() as { businessUnits: Array<{ name: string; accountCount: number; openHighRiskFindings: number }> }).businessUnits;
    assert.deepEqual(businessUnits, [
      { name: "Active BU", accountCount: 1, averageSecurityScore: 88, averageComplianceScore: 70, openHighRiskFindings: 1 }
    ]);

    const reportSummary = await app.inject({
      method: "GET",
      url: "/api/v1/reports/summary",
      headers: sessionHeaders(tenantA)
    });
    assert.equal(reportSummary.statusCode, 200, reportSummary.body);
    assert.equal((reportSummary.json() as { counts: { openRiskCount: number } }).counts.openRiskCount, 1);

    const reportPreview = await app.inject({
      method: "POST",
      url: "/api/v1/reports/preview",
      headers: sessionHeaders(tenantA),
      payload: { reportType: "AWS_ACCOUNT_GOVERNANCE_SUMMARY" }
    });
    assert.equal(reportPreview.statusCode, 200, reportPreview.body);
    const reportBody = reportPreview.json() as { metrics: Array<{ label: string; value: string | number | boolean }> };
    assert.equal(reportBody.metrics.find((metric) => metric.label === "AWS accounts")?.value, 1);
    const reportText = JSON.stringify(reportBody);
    assert.equal(reportText.includes(fixture.archivedAccount.name), false);
    assert.equal(reportText.includes(fixture.archivedFinding.title), false);
  });

  await t.test("active account operational validation behavior is unchanged and safe", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/aws/accounts/${fixture.activeAccount.id}/validate`,
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 200, res.body);
    assert.equal((res.json() as { code: string }).code, "REGISTRY_READY_FOR_STS_VALIDATION");
  });
});

async function seedArchivedLifecycleFixture(tenantA: Session, tenantB: Session) {
  const activeAccount = await createAccount(tenantA.orgId, "Lifecycle Active Account", uniqueAccountId("111"), null, "Active BU", 88, 70);
  const archivedAccount = await createAccount(
    tenantA.orgId,
    "Lifecycle Archived Account",
    uniqueAccountId("222"),
    new Date("2026-06-01T00:00:00.000Z"),
    "Archived BU",
    10,
    5
  );
  const otherTenantAccount = await createAccount(tenantB.orgId, "Other Tenant Archived Account", uniqueAccountId("333"), new Date("2026-06-01T00:00:00.000Z"), "Other BU", 1, 1);

  const activeResource = await createResource(tenantA.orgId, activeAccount.id, "active-resource-visible", "VPC");
  const archivedResource = await createResource(tenantA.orgId, archivedAccount.id, "archived-resource-hidden", "VPC");
  await createResource(tenantB.orgId, otherTenantAccount.id, "other-tenant-resource-hidden", "VPC");

  const activeFinding = await createFinding(tenantA.orgId, activeAccount.id, activeResource.id, "Active account high finding", "HIGH");
  const archivedFinding = await createFinding(tenantA.orgId, archivedAccount.id, archivedResource.id, "Archived account high finding", "CRITICAL");
  await createFinding(tenantB.orgId, otherTenantAccount.id, null, "Other tenant hidden finding", "CRITICAL");

  return {
    activeAccount,
    archivedAccount,
    otherTenantAccount,
    activeResource,
    archivedResource,
    activeFinding,
    archivedFinding
  };
}

async function createAccount(
  organizationId: string,
  name: string,
  accountId: string,
  archivedAt: Date | null,
  businessUnit: string,
  securityScore: number,
  complianceScore: number
) {
  return prisma.awsAccount.create({
    data: {
      organizationId,
      name,
      accountId,
      environment: "sandbox",
      regions: ["ap-south-1"],
      status: "CONNECTED",
      connectionStatus: archivedAt ? "DISABLED" : "VALIDATION_SUCCEEDED",
      archivedAt,
      businessUnit,
      securityScore,
      complianceScore
    }
  });
}

async function createResource(
  organizationId: string,
  awsAccountId: string,
  name: string,
  resourceType: string
) {
  return prisma.cloudResource.create({
    data: {
      organizationId,
      awsAccountId,
      name,
      resourceType,
      resourceId: `${resourceType.toLowerCase()}-${randomUUID()}`,
      region: "ap-south-1",
      source: "AWS_SYNC",
      status: "active",
      metadata: { safe: true } satisfies Prisma.InputJsonObject,
      tags: { owner: "platform" } satisfies Prisma.InputJsonObject
    }
  });
}

async function createFinding(
  organizationId: string,
  awsAccountId: string,
  resourceId: string | null,
  title: string,
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
) {
  return prisma.securityFinding.create({
    data: {
      organizationId,
      awsAccountId,
      resourceId,
      ruleId: `lifecycle-${randomUUID()}`,
      title,
      description: `${title} description`,
      severity,
      status: "OPEN",
      workflowStatus: "OPEN",
      evidence: { safe: true } satisfies Prisma.InputJsonObject,
      source: "AWS_SYNC",
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

  assert.equal(registerRes.statusCode, 200, registerRes.body);
  const session = registerRes.cookies.find((cookie) => cookie.name === "cloudshield_session")?.value;
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

function resourceIds(body: { items: Array<{ resourceId: string }> }) {
  return body.items.map((item) => item.resourceId);
}

function uniqueAccountId(prefix: string) {
  return `${prefix}${Date.now()}`.slice(0, 12).padEnd(12, "0");
}

async function cleanupTestOrganizations(organizationIds: string[]) {
  if (organizationIds.length === 0) return;
  const scopedWhere = { organizationId: { in: organizationIds } };

  await prisma.reportExport.deleteMany({ where: scopedWhere });
  await prisma.securityFinding.deleteMany({ where: scopedWhere });
  await prisma.cloudResource.deleteMany({ where: scopedWhere });
  await prisma.awsAccount.deleteMany({ where: scopedWhere });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
}
