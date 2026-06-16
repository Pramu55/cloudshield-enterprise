import test from "node:test";
import assert from "node:assert";
import { performGlobalSearch } from "../modules/platform-core/search.service.js";
import { prisma, Environment, AwsAccountStatus } from "@cloudshield/database";

test("Global Search Backend", async (t) => {
  const baseAuth = {
    userId: "u-1",
    organizationId: "org-1",
    email: "test@example.com",
    role: "VIEWER",
    organizationName: "Org 1"
  };

  // We are not mocking Prisma because this is an integration test suite.
  // We'll insert test data.
  const uniquePrefix = `search_test_${Date.now()}`;
  const testAccountId = createUniqueTestAccountId();

  // Setup data
  let orgId = "";
  let userId = "";
  let awsAccountId = "";

  t.before(async () => {
    // Create an organization
    const org = await prisma.organization.create({
      data: { name: `${uniquePrefix}_org`, slug: `${uniquePrefix}_org` }
    });
    orgId = org.id;

    // Create a user
    const user = await prisma.user.create({
      data: {
        name: `${uniquePrefix}_user`,
        email: `${uniquePrefix}@example.com`,
        organizationId: org.id,
        passwordHash: "dummy"
      }
    });
    userId = user.id;

    baseAuth.organizationId = orgId;
    baseAuth.userId = userId;

    // Create some search entities
    const account = await prisma.awsAccount.create({
      data: {
        organizationId: orgId,
        accountId: testAccountId,
        name: "Test Account",
        environment: Environment.prod,
        status: AwsAccountStatus.CONNECTED
      }
    });
    awsAccountId = account.id;

    const team = await prisma.team.create({
      data: {
        organizationId: orgId,
        name: "Backend Team",
        businessUnit: "Engineering"
      }
    });

    const orgMem = await prisma.organizationMembership.create({
      data: {
        organizationId: orgId,
        userId: userId,
        role: "VIEWER",
        status: "ACTIVE" as any
      }
    });

    await prisma.teamMembership.create({
      data: {
        teamId: team.id,
        organizationId: orgId,
        organizationMembershipId: orgMem.id
      }
    });

    const team2 = await prisma.team.create({
      data: {
        organizationId: orgId,
        name: "Hidden Team",
        businessUnit: "Marketing"
      }
    });
  });

  t.after(async () => {
    // Cleanup
    if (awsAccountId) {
      await prisma.awsAccount.delete({ where: { id: awsAccountId } }).catch(() => undefined);
    }
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  await t.test("returns empty result when no permissions match", async () => {
    const auth = { ...baseAuth, role: "UNKNOWN_ROLE" };
    const res = await performGlobalSearch(auth, "test", undefined, 5);
    assert.strictEqual(res.groups.length, 0);
    assert.strictEqual(res.total, 0);
  });

  await t.test("limits types to maximum of 8 when requestedTypes exceeds", async () => {
    const auth = { ...baseAuth, role: "OWNER" };
    const typesToSearch: any = [
      "awsAccount", "resource", "finding", "team", "member", "invitation", "scanRun", "complianceControl", "recommendation", "operation"
    ];
    const res = await performGlobalSearch(auth, "Test Account", typesToSearch, 5);
    assert.ok(res.groups.length <= 8);
  });

  await t.test("enforces tenant isolation and returns expected AWS account", async () => {
    const auth = { ...baseAuth, role: "OWNER" };
    const res = await performGlobalSearch(auth, "Test Account", ["awsAccount"], 5);
    assert.strictEqual(res.groups.length, 1);
    assert.strictEqual(res.groups[0]!.type, "awsAccount");
    assert.strictEqual(res.groups[0]!.results.length, 1);
    assert.strictEqual(res.groups[0]!.results[0]!.title, "Test Account");
  });

  await t.test("restricts team search for VIEWER to only their teams", async () => {
    const auth = { ...baseAuth, role: "VIEWER" };
    const res = await performGlobalSearch(auth, "Team", ["team"], 5);
    // Should only see "Backend Team"
    assert.strictEqual(res.groups.length, 1);
    assert.strictEqual(res.groups[0]!.type, "team");
    assert.strictEqual(res.groups[0]!.results.length, 1);
    assert.strictEqual(res.groups[0]!.results[0]!.title, "Backend Team");
  });

  await t.test("allows OWNER to search all teams", async () => {
    const auth = { ...baseAuth, role: "OWNER" };
    const res = await performGlobalSearch(auth, "Team", ["team"], 5);
    // Should see both "Backend Team" and "Hidden Team"
    assert.strictEqual(res.groups.length, 1);
    assert.strictEqual(res.groups[0]!.type, "team");
    assert.strictEqual(res.groups[0]!.results.length, 2);
    const titles = res.groups[0]!.results.map(r => r.title);
    assert.ok(titles.includes("Backend Team"));
    assert.ok(titles.includes("Hidden Team"));
  });
});

function createUniqueTestAccountId(): string {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
  return `987${suffix.padStart(9, "0")}`;
}
