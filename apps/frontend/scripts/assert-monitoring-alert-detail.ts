import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SecurityAlertLifecycleMutationResponseSchema, EvaluateMonitoringResponseSchema } from "@cloudshield/contracts";
import { ApiRequestError } from "../lib/api-error";
import { clearCsrfToken, fetchCloudShieldClient } from "../lib/client-api";
import {
  FrontendCapabilitySessionSchema,
  FrontendMonitoringHealthSchema,
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

async function assertMutationRequiresValidatedConfirmation(action: "acknowledge" | "resolve" | "evaluate") {
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
    if (url.endsWith(action === "evaluate" ? "/evaluate" : `/${action}`)) {
      mutationCalls += 1;
      return action === "evaluate" ? json({ status: "QUEUED", message: "Security monitoring evaluation queued successfully." }) : json({ status: "ok" });
    }
    detailCalls += 1;
    if (action === "evaluate") return json({
      status: "HEALTHY", message: "ok", lastEvaluatedAt: timestamp,
      openCriticalAlerts: 0, openHighAlerts: 0, staleAccounts: 0,
      monitoredAccounts: 1, degradedAccounts: 0
    });
    return json(action === "acknowledge"
      ? { ...alert, status: "ACKNOWLEDGED" }
      : { ...alert, status: "RESOLVED", resolvedAt: timestamp });
  };

  let acceptance: any;
  if (action === "evaluate") {
    acceptance = await fetchCloudShieldClient("/api/v1/security-monitoring/evaluate", {
      method: "POST",
      body: { trigger: "MANUAL" },
      schema: EvaluateMonitoringResponseSchema
    });
    assert.deepEqual(acceptance, { status: "QUEUED", message: "Security monitoring evaluation queued successfully." });
    const confirmed = await fetchCloudShieldClient("/api/v1/security-monitoring/health", { schema: FrontendMonitoringHealthSchema });
    assert.equal(confirmed.status, "HEALTHY");
  } else {
    acceptance = await fetchCloudShieldClient(`/api/v1/security-monitoring/alerts/alert-1/${action}`, {
      method: "PATCH",
      body: action === "acknowledge" ? { note: "Reviewing" } : { reason: "Resolved by operator" },
      schema: SecurityAlertLifecycleMutationResponseSchema
    });
    assert.deepEqual(acceptance, { status: "ok" });
    const confirmed = await fetchCloudShieldClient("/api/v1/security-monitoring/alerts/alert-1", { schema: FrontendSecurityAlertDetailSchema });
    assert.equal(confirmed.status, action === "acknowledge" ? "ACKNOWLEDGED" : "RESOLVED");
    if (action === "resolve") assert.equal(confirmed.resolvedAt, timestamp);
  }

  assert.equal(csrfCalls, 1);
  assert.equal(mutationCalls, 1, `${action} mutation must execute exactly once`);
  assert.equal(detailCalls, 1, `${action} confirmation read must execute exactly once`);
}

async function assertMalformedMutationSkipsConfirmation(action: "acknowledge" | "resolve" | "evaluate") {
  clearCsrfToken();
  let mutationCalls = 0;
  let detailCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/api/v1/auth/csrf")) return json({ token: "monitoring-csrf-token" });
    if (url.endsWith(action === "evaluate" ? "/evaluate" : `/${action}`)) {
      mutationCalls += 1;
      return action === "evaluate" ? json({ status: "QUEUED", message: "Security monitoring evaluation queued successfully.", rawResponse: { provider: true } }) : json({ status: "ok", rawResponse: { provider: true } });
    }
    detailCalls += 1;
    return json(alert);
  };

  if (action === "evaluate") {
    await expectKind(() => fetchCloudShieldClient("/api/v1/security-monitoring/evaluate", {
      method: "POST",
      body: { trigger: "MANUAL" },
      schema: EvaluateMonitoringResponseSchema
    }), "CONTRACT_INVALID");
  } else {
    await expectKind(() => fetchCloudShieldClient(`/api/v1/security-monitoring/alerts/alert-1/${action}`, {
      method: "PATCH",
      body: action === "acknowledge" ? { note: "Reviewing" } : { reason: "Resolved by operator" },
      schema: SecurityAlertLifecycleMutationResponseSchema
    }), "CONTRACT_INVALID");
  }
  assert.equal(mutationCalls, 1);
  assert.equal(detailCalls, 0, `${action} confirmation must not run after malformed mutation response`);
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
    await assertMutationRequiresValidatedConfirmation("evaluate");
    await assertMalformedMutationSkipsConfirmation("acknowledge");
    await assertMalformedMutationSkipsConfirmation("resolve");
    await assertMalformedMutationSkipsConfirmation("evaluate");

    assert.deepEqual(SecurityAlertLifecycleMutationResponseSchema.parse({ status: "ok" }), { status: "ok" });
    for (const invalid of [
      {},
      { status: "unknown" },
      { status: "ok", extra: true },
      { status: "ok", alertStatus: "ACKNOWLEDGED" },
      { status: "ok", rawError: "provider failed" },
      { status: "ok", AccessKeyId: "AKIA0000000000000000" }
    ]) {
      assert.equal(SecurityAlertLifecycleMutationResponseSchema.safeParse(invalid).success, false);
    }

    clearCsrfToken();
    globalThis.fetch = async (input) => String(input).endsWith("/api/v1/auth/csrf")
      ? json({ token: "monitoring-csrf-token" })
      : new Response("", { status: 200 });
    assert.equal(await fetchCloudShieldClient("/api/v1/security-monitoring/alerts/alert-1/acknowledge", {
      method: "PATCH",
      body: { note: "Reviewing" },
      schema: SecurityAlertLifecycleMutationResponseSchema
    }), undefined);

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

    const detailSource = await readFile(new URL("../app/dashboard/monitoring/alerts/[id]/page.tsx", import.meta.url), "utf8");
    const listSource = await readFile(new URL("../app/dashboard/monitoring/page.tsx", import.meta.url), "utf8");
    for (const source of [detailSource, listSource]) {
      assert.equal((source.match(/SecurityAlertLifecycleMutationResponseSchema/g) ?? []).length >= 3, true);
      assert.equal(source.includes("console.error"), false);
      assert.equal(source.includes("alert("), false);
      assert.equal(/\bretry\s*:/i.test(source), false);
    }
    assert.equal(/setAlert\([^)]*status/i.test(detailSource), false);
    assert.equal(/setAlerts\([^)]*status/i.test(listSource), false);
    assert.equal(detailSource.includes("if (!acceptance) throw new ApiRequestError(contractInvalidError())"), true);
    assert.equal(listSource.includes("if (!acceptance) throw monitoringActionContractError()"), true);
    assert.equal(/const loadData = async \(\): Promise<boolean> =>/.test(listSource), true);
    assert.equal(/return true;\s*\} catch/.test(listSource), true);
    assert.equal(/return false;\s*\} finally/.test(listSource), true);
    assert.equal(/const confirmed = await loadData\(\);/.test(listSource), true);
    assert.equal(/if \(\!confirmed\) \{\s*throw monitoringActionContractError\(\);\s*\}/.test(listSource), true);
    assert.equal(listSource.indexOf("if (!acceptance)") < listSource.indexOf("const confirmed = await loadData()"), true);
    assert.equal(/finally\s*\{[^}]*loadData/.test(listSource), false);
    assert.equal(listSource.includes("setAlerts(a.items)"), true);
    assert.equal(listSource.includes("setAlerts(a.items || [])"), false);
    assert.equal(/setAlerts\([^)]*status/.test(listSource), false);
    assert.equal(/setHealth\([^)]*QUEUED/.test(listSource), false);
    assert.equal(/setRuns\([^)]*QUEUED/.test(listSource), false);
    assert.equal(listSource.includes("COMPLETED") && listSource.includes("QUEUED") && /QUEUED.*COMPLETED/.test(listSource), false);
    assert.equal(listSource.includes("EvaluateMonitoringResponseSchema"), true);
    assert.equal(listSource.includes("EvaluateMonitoringResponse"), true);

    const evaluateMatch = listSource.match(/const handleEvaluate = async \(\) => \{([\s\S]*?)\} catch/);
    assert.ok(evaluateMatch);
    const evaluateBody = evaluateMatch[1] ?? "";
    assert.equal((evaluateBody.match(/const confirmed = await loadData\(\)/g) || []).length, 1);
    assert.equal(evaluateBody.indexOf("if (!acceptance)") < evaluateBody.indexOf("const confirmed = await loadData()"), true);
    assert.equal(evaluateBody.includes("throw monitoringActionContractError()"), true);
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
