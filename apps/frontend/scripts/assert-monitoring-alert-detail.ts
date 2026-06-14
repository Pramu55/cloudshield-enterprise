import assert from "node:assert/strict";
import { ApiRequestError } from "../lib/api-error";
import { clearCsrfToken, fetchCloudShieldClient } from "../lib/client-api";
import {
  FrontendCapabilitySessionSchema,
  FrontendSecurityAlertDetailSchema,
  resolveFrontendAlertRouteId
} from "../lib/response-contracts";

const originalFetch = globalThis.fetch;
const timestamp = "2026-06-14T12:00:00.000Z";
const alert = {
  id: "alert-1",
  organizationId: "org-1",
  awsAccountId: null,
  cloudResourceId: null,
  securityFindingId: null,
  monitorId: null,
  dedupeKey: "alert-key",
  title: "Security alert",
  description: "A monitored condition was detected.",
  severity: "HIGH",
  status: "OPEN",
  category: "SECURITY_FINDING",
  firstObservedAt: timestamp,
  lastObservedAt: timestamp,
  resolvedAt: null,
  evidenceCount: 0,
  mappedEvidence: [],
  sourceType: null,
  sourceId: null,
  createdAt: timestamp,
  updatedAt: timestamp
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function expectKind(run: () => Promise<unknown>, kind: string) {
  await assert.rejects(run, (error: unknown) => error instanceof ApiRequestError && error.apiError.kind === kind);
}

async function requestResolvedAlertId(value: string | string[] | undefined): Promise<void> {
  const resolvedId = resolveFrontendAlertRouteId(value);
  if (resolvedId === null) return;
  await fetchCloudShieldClient(`/api/v1/security-monitoring/alerts/${encodeURIComponent(resolvedId)}`);
}

async function assertMutationRequiresValidatedConfirmation(action: "acknowledge" | "resolve") {
  clearCsrfToken();
  let csrfCalls = 0;
  let mutationCalls = 0;
  let detailCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/api/v1/auth/csrf")) {
      csrfCalls += 1;
      return json({ token: "monitoring-csrf-token" });
    }
    if (url.endsWith(`/${action}`)) {
      mutationCalls += 1;
      return json({ status: "ok", rawResponse: { provider: true } });
    }
    detailCalls += 1;
    return json({ ...alert, status: "UNKNOWN" });
  };

  await fetchCloudShieldClient(`/api/v1/security-monitoring/alerts/alert-1/${action}`, {
    method: "PATCH",
    body: action === "acknowledge" ? { note: "Reviewing" } : { reason: "Resolved by operator" }
  });
  await expectKind(() => fetchCloudShieldClient("/api/v1/security-monitoring/alerts/alert-1", { schema: FrontendSecurityAlertDetailSchema }), "CONTRACT_INVALID");
  assert.equal(csrfCalls, 1);
  assert.equal(mutationCalls, 1, `${action} mutation must execute exactly once`);
  assert.equal(detailCalls, 1, `${action} confirmation read must execute exactly once`);
}

async function main() {
  try {
    const invalidRouteIds: Array<string | string[] | undefined> = [
      undefined,
      ["alert-1"],
      "",
      " alert-1 ",
      "alert\u0000id",
      "alert/1",
      "alert\\1",
      "alert?view=detail",
      "alert#details"
    ];
    for (const invalidId of invalidRouteIds) {
      let providerCalls = 0;
      globalThis.fetch = async () => {
        providerCalls += 1;
        return json(alert);
      };
      assert.equal(resolveFrontendAlertRouteId(invalidId), null);
      await requestResolvedAlertId(invalidId);
      assert.equal(providerCalls, 0, "invalid route identifiers must not execute a provider request");
    }

    let validProviderCalls = 0;
    globalThis.fetch = async () => {
      validProviderCalls += 1;
      return json(alert);
    };
    assert.equal(resolveFrontendAlertRouteId("alert-1"), "alert-1");
    await requestResolvedAlertId("alert-1");
    assert.equal(validProviderCalls, 1);

    globalThis.fetch = async () => json({
      user: { id: "user-1", email: "operator@example.com", name: "Operator", role: "OWNER", organizationId: "org-1" },
      organization: { id: "org-1", name: "CloudShield", slug: "cloudshield" }
    });
    await expectKind(() => fetchCloudShieldClient("/api/v1/auth/me", { schema: FrontendCapabilitySessionSchema }), "CONTRACT_INVALID");

    await assertMutationRequiresValidatedConfirmation("acknowledge");
    await assertMutationRequiresValidatedConfirmation("resolve");

    clearCsrfToken();
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return json({}); };
    await expectKind(() => fetchCloudShieldClient("/mutation", { method: "PATCH" }), "UNKNOWN");
    assert.equal(calls, 1, "missing CSRF token must prevent the mutation provider call");

    calls = 0;
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = async () => { calls += 1; return json(alert); };
    await expectKind(() => fetchCloudShieldClient("/cancelled", { signal: controller.signal }), "CANCELLED");
    assert.equal(calls, 0);

    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await fetchCloudShieldClient("/empty"), undefined);
    globalThis.fetch = async () => new Response(null, { status: 205 });
    assert.equal(await fetchCloudShieldClient("/reset-content"), undefined);

    globalThis.fetch = async () => json({ message: "forbidden" }, 403);
    await assert.rejects(() => fetchCloudShieldClient("/forbidden"), (error: unknown) => error instanceof ApiRequestError && error.apiError.kind === "FORBIDDEN" && !error.apiError.sessionExpired);

    clearCsrfToken();
    globalThis.fetch = async () => json({ message: "expired" }, 401);
    await assert.rejects(() => fetchCloudShieldClient("/mutation", { method: "PATCH" }), (error: unknown) => error instanceof ApiRequestError && error.apiError.kind === "UNAUTHENTICATED" && error.apiError.sessionExpired);

    console.log("Frontend monitoring alert-detail client assertions passed.");
  } finally {
    globalThis.fetch = originalFetch;
    clearCsrfToken();
  }
}

void main();
