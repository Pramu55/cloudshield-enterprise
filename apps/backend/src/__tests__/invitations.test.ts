import test from "node:test";
import assert from "node:assert";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { randomUUID } from "node:crypto";

test("Invitation Mutation Isolation", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  let csrfToken = "";
  let sessionCookie = "";
  let orgId = "";
  let userId = "";

  await t.test("setup auth and organization", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    csrfToken = res.json().token;
    sessionCookie = `_csrf=${res.cookies.find(c => c.name === "_csrf")?.value}`;

    const email = `inviter-${Date.now()}@example.com`;
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        name: "Inviter User",
        email,
        organization: "Inviter Org",
        password: "Password123!",
        confirmPassword: "Password123!"
      }
    });

    const sessionObj = regRes.cookies.find(c => c.name === "cloudshield_session");
    sessionCookie += `; cloudshield_session=${sessionObj?.value}`;
    orgId = regRes.json().organization.id;
    userId = regRes.json().user.id;

    const newCsrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf", headers: { cookie: sessionCookie } });
    csrfToken = newCsrf.json().token;
  });

  await t.test("cross-tenant ID cannot update invitation", async () => {
    const otherOrg = await prisma.organization.create({
      data: { id: randomUUID(), name: "Other Org", slug: `other-org-${Date.now()}` }
    });
    const otherUser = await prisma.user.create({
      data: {
        id: randomUUID(), organizationId: otherOrg.id, email: `other-${Date.now()}@example.com`, emailNormalized: `other-${Date.now()}@example.com`
      }
    });

    const otherInvitation = await prisma.invitation.create({
      data: {
        id: randomUUID(),
        organizationId: otherOrg.id,
        email: `guest-${Date.now()}@example.com`,
        role: "VIEWER",
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 100000),
        inviterId: otherUser.id
      }
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/members/invite/${otherInvitation.id}/revoke?organizationId=${orgId}`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { organizationId: orgId }
    });

    assert.strictEqual(res.statusCode, 404);

    const check = await prisma.invitation.findUnique({ where: { id: otherInvitation.id } });
    assert.strictEqual(check?.revokedAt, null);
  });

  await t.test("missing invitation returns safe 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/members/invite/${randomUUID()}/resend`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken }
    });

    assert.strictEqual(res.statusCode, 404);
  });

  await t.test("same-tenant update succeeds", async () => {
    const invitation = await prisma.invitation.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        email: `guest-same-${Date.now()}@example.com`,
        role: "VIEWER",
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 100000),
        inviterId: userId
      }
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/members/invite/${invitation.id}/revoke`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken }
    });

    assert.strictEqual(res.statusCode, 200);

    const check = await prisma.invitation.findUnique({ where: { id: invitation.id } });
    assert.notStrictEqual(check?.revokedAt, null);
  });
});
