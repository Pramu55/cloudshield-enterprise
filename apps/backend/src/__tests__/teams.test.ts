import test from "node:test";
import assert from "node:assert";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { ROLES } from "@cloudshield/security";

test("Teams Endpoints", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close()
    ]);
    await prisma.$disconnect();
  });

  let csrfToken = "";
  let sessionCookie = "";
  let registeredUserId = "";
  let registeredOrgId = "";

  const testEmail = `team-test-${Date.now()}@example.com`;

  await t.test("Setup test user and org", async () => {
    const resCsrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    csrfToken = resCsrf.json().token;
    sessionCookie = `_csrf=${resCsrf.cookies.find(c => c.name === "_csrf")?.value}`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        name: "Team Test User",
        email: testEmail,
        organization: "Team Test Org",
        password: "Password123!",
        confirmPassword: "Password123!"
      }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    registeredUserId = body.user.id;
    registeredOrgId = body.organization.id;

    const sessionCookieObj = res.cookies.find(
      (cookie) => cookie.name === "cloudshield_session"
    );

    assert.ok(
      sessionCookieObj?.value,
      `Registration did not return cloudshield_session. Cookies: ${res.cookies
        .map((cookie) => cookie.name)
        .join(", ")}`
    );

    sessionCookie = `_csrf=${resCsrf.cookies.find(
      (cookie) => cookie.name === "_csrf"
    )?.value}; cloudshield_session=${sessionCookieObj.value}`;

    const newCsrfRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
      headers: { cookie: sessionCookie }
    });

    const rotatedCsrfCookie = newCsrfRes.cookies.find(
      (cookie) => cookie.name === "_csrf"
    );

    if (rotatedCsrfCookie?.value) {
      sessionCookie =
        `_csrf=${rotatedCsrfCookie.value}; ` +
        `cloudshield_session=${sessionCookieObj.value}`;
    }

    csrfToken = newCsrfRes.json().token;

    const meRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: sessionCookie
      }
    });

    assert.strictEqual(
      meRes.statusCode,
      200,
      `Authenticated session check failed: ${meRes.body}`
    );

    const { createHash } = await import("node:crypto");

    const tokenHash = createHash("sha256")
      .update(sessionCookieObj.value)
      .digest("hex");

    const storedSession = await prisma.authSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            organizationMemberships: true
          }
        }
      }
    });

    assert.ok(storedSession, "Registration session was not persisted");
    assert.strictEqual(storedSession.revokedAt, null);
    assert.strictEqual(storedSession.organizationId, registeredOrgId);
    assert.strictEqual(storedSession.user.status, "ACTIVE");
    assert.ok(
      storedSession.user.organizationMemberships.some(
        (membership) =>
          membership.organizationId === registeredOrgId &&
          membership.status === "ACTIVE"
      ),
      "Registered user has no active organization membership"
    );

    // Promote to OWNER just to be sure
    await prisma.organizationMembership.updateMany({
      where: { organizationId: registeredOrgId, userId: registeredUserId },
      data: { role: ROLES.OWNER }
    });
  });

  let teamId = "";
  let teamMemberId = "";

  await t.test("Create a team", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/teams",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        name: "Security Team",
        email: "sec@example.com"
      }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.team.id);
    assert.strictEqual(body.team.name, "Security Team");
    teamId = body.team.id;
  });

  await t.test("Create another user to add to the team", async () => {
    const user2 = await prisma.user.create({
      data: {
        organizationId: registeredOrgId,
        email: `team-test-2-${Date.now()}@example.com`,
        emailNormalized: `team-test-2-${Date.now()}@example.com`,
        name: "User 2",
        passwordHash: "dummy"
      }
    });
    const membership = await prisma.organizationMembership.create({
      data: {
        organizationId: registeredOrgId,
        userId: user2.id,
        role: ROLES.VIEWER,
        status: "ACTIVE"
      }
    });
    teamMemberId = membership.id;
  });

  await t.test("Add member to team", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/teams/${teamId}/members`,
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        organizationMembershipId: teamMemberId
      }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.membership.organizationMembershipId, teamMemberId);
    assert.strictEqual(body.membership.isLead, false);
  });

  await t.test("Update member to lead", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/teams/${teamId}/members/${teamMemberId}/lead`,
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        isLead: true
      }
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json().membership.isLead, true);
  });

  await t.test("List teams", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/teams",
      headers: { cookie: sessionCookie }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.teams.length, 1);
    assert.strictEqual(body.teams[0].name, "Security Team");
    assert.strictEqual(body.teams[0].members.length, 1);
    assert.strictEqual(body.teams[0].members[0].isLead, true);
  });

  await t.test("Remove member from team", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/teams/${teamId}/members/${teamMemberId}`,
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie }
    });

    assert.strictEqual(res.statusCode, 200);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/teams",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(listRes.json().teams[0].members.length, 0);
  });

  await t.test("Archive a team", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/teams/${teamId}/archive`,
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie }
    });

    assert.strictEqual(res.statusCode, 200);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/teams",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(listRes.json().teams.length, 0); // Excluded since it's archived
  });
});
