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

test("inventory resource filtering is tenant-scoped and same-org account isolated", async (t) => {
  const app = await buildApp();
  const createdOrgIds: string[] = [];

  t.after(async () => {
    await cleanupTestOrganizations(createdOrgIds);
    await app.close();
    await prisma.$disconnect();
  });

  const tenantA = await registerTenant(app, "inventory-isolation-a");
  const tenantB = await registerTenant(app, "inventory-isolation-b");
  createdOrgIds.push(tenantA.orgId, tenantB.orgId);

  const fixture = await seedInventoryIsolationFixture(tenantA, tenantB);

  await t.test("tenant A cannot see tenant B inventory resources", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/inventory/resources?limit=100",
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 200, res.body);
    const ids = resourceIds(res.json());

    assert.ok(ids.includes(fixture.accountAResource.resourceId));
    assert.ok(ids.includes(fixture.accountBResource.resourceId));
    assert.equal(ids.includes(fixture.otherTenantResource.resourceId), false);
  });

  await t.test("same-org account filter returns only that account resources", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/resources?accountId=${encodeURIComponent(fixture.accountA.id)}&limit=100`,
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 200, res.body);
    const ids = resourceIds(res.json());

    assert.deepEqual(
      ids.sort(),
      [fixture.accountAResource.resourceId, fixture.accountATaggedResource.resourceId, fixture.secretMetadataResource.resourceId].sort()
    );
    assert.equal(ids.includes(fixture.accountBResource.resourceId), false);
  });

  await t.test("account filter and search compose with AND instead of broad top-level OR", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/resources?accountId=${encodeURIComponent(fixture.accountA.id)}&search=${encodeURIComponent("only-account-b")}&limit=100`,
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(resourceIds(res.json()), []);
  });

  await t.test("account filter composes with tag, type, and region as AND clauses", async () => {
    const matching = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/resources?accountId=${encodeURIComponent(fixture.accountA.id)}&tag=${encodeURIComponent("owner-tagged")}&type=SUBNET&region=ap-south-1&limit=100`,
      headers: sessionHeaders(tenantA)
    });

    assert.equal(matching.statusCode, 200, matching.body);
    assert.deepEqual(resourceIds(matching.json()), [fixture.accountATaggedResource.resourceId]);

    const wrongRegion = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/resources?accountId=${encodeURIComponent(fixture.accountA.id)}&tag=${encodeURIComponent("owner-tagged")}&type=SUBNET&region=us-east-1&limit=100`,
      headers: sessionHeaders(tenantA)
    });

    assert.equal(wrongRegion.statusCode, 200, wrongRegion.body);
    assert.deepEqual(resourceIds(wrongRegion.json()), []);
  });

  await t.test("archived parent account behavior is documented by existing resource route semantics", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/resources?accountId=${encodeURIComponent(fixture.archivedAccount.id)}&lifecycle=active&limit=100`,
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(resourceIds(res.json()), [fixture.archivedAccountResource.resourceId]);
  });

  await t.test("inventory response redacts secret-like metadata and raw provider payloads", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/inventory/resources?accountId=${encodeURIComponent(fixture.accountA.id)}&search=${encodeURIComponent("secret-sanitized")}&limit=100`,
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.deepEqual(resourceIds(body), [fixture.secretMetadataResource.resourceId]);

    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes("rawProviderResponse-should-not-leak"), false);
    assert.equal(serialized.includes("SecretAccessKey-should-not-leak"), false);
    assert.equal(serialized.includes("sessionToken-should-not-leak"), false);
    assert.equal(serialized.includes("[REDACTED]"), true);
  });
});

async function seedInventoryIsolationFixture(tenantA: Session, tenantB: Session) {
  const accountA = await createAccount(tenantA.orgId, "Account A", uniqueAccountId("101"), null);
  const accountB = await createAccount(tenantA.orgId, "Account B", uniqueAccountId("202"), null);
  const archivedAccount = await createAccount(tenantA.orgId, "Archived Account", uniqueAccountId("303"), new Date("2026-06-01T00:00:00.000Z"));
  const otherTenantAccount = await createAccount(tenantB.orgId, "Tenant B Account", uniqueAccountId("404"), null);

  const accountAResource = await createResource(tenantA.orgId, accountA.id, {
    name: "account-a-vpc",
    resourceType: "VPC",
    resourceId: `vpc-account-a-${randomUUID()}`,
    region: "ap-south-1"
  });
  const accountATaggedResource = await createResource(tenantA.orgId, accountA.id, {
    name: "owner-tagged-subnet",
    resourceType: "SUBNET",
    resourceId: `subnet-owner-tagged-${randomUUID()}`,
    region: "ap-south-1"
  });
  const secretMetadataResource = await createResource(tenantA.orgId, accountA.id, {
    name: "secret-sanitized-resource",
    resourceType: "SECURITY_GROUP",
    resourceId: `sg-secret-sanitized-${randomUUID()}`,
    region: "ap-south-1",
    metadata: {
      normalField: "safe-value",
      rawProviderResponse: "rawProviderResponse-should-not-leak",
      nested: {
        SecretAccessKey: "SecretAccessKey-should-not-leak",
        sessionToken: "sessionToken-should-not-leak"
      }
    },
    tags: {
      owner: "platform",
      externalId: "externalId-should-not-leak"
    }
  });
  const accountBResource = await createResource(tenantA.orgId, accountB.id, {
    name: "only-account-b-resource",
    resourceType: "VPC",
    resourceId: `vpc-only-account-b-${randomUUID()}`,
    region: "ap-south-1"
  });
  const archivedAccountResource = await createResource(tenantA.orgId, archivedAccount.id, {
    name: "archived-parent-active-resource",
    resourceType: "VPC",
    resourceId: `vpc-archived-parent-${randomUUID()}`,
    region: "ap-south-1"
  });
  const otherTenantResource = await createResource(tenantB.orgId, otherTenantAccount.id, {
    name: "tenant-b-resource",
    resourceType: "VPC",
    resourceId: `vpc-tenant-b-${randomUUID()}`,
    region: "ap-south-1"
  });

  return {
    accountA,
    accountB,
    archivedAccount,
    accountAResource,
    accountATaggedResource,
    secretMetadataResource,
    accountBResource,
    archivedAccountResource,
    otherTenantResource
  };
}

async function createAccount(organizationId: string, name: string, accountId: string, archivedAt: Date | null) {
  return prisma.awsAccount.create({
    data: {
      organizationId,
      name,
      accountId,
      environment: "sandbox",
      regions: ["ap-south-1"],
      status: "CONNECTED",
      connectionStatus: archivedAt ? "DISABLED" : "VALIDATION_SUCCEEDED",
      archivedAt
    }
  });
}

async function createResource(
  organizationId: string,
  awsAccountId: string,
  input: {
    name: string;
    resourceType: string;
    resourceId: string;
    region: string;
    metadata?: Prisma.InputJsonValue;
    tags?: Prisma.InputJsonValue;
  }
) {
  return prisma.cloudResource.create({
    data: {
      organizationId,
      awsAccountId,
      name: input.name,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      region: input.region,
      source: "AWS_SYNC",
      status: "active",
      metadata: input.metadata ?? {},
      tags: input.tags ?? {}
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

  await prisma.cloudResource.deleteMany({ where: scopedWhere });
  await prisma.awsAccount.deleteMany({ where: scopedWhere });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
}
