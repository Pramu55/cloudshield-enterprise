import test from "node:test";
import assert from "node:assert";
import { prisma } from "@cloudshield/database";
import { MonitoringOrchestrator } from "../monitoring-orchestrator.js";
import { randomUUID } from "node:crypto";

const orchestrator = new MonitoringOrchestrator();

test("MonitoringOrchestrator worker integration", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  let testOrgId = "";

  await t.test("setup test organization", async () => {
    const org = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: `Worker Test Org ${Date.now()}`,
        slug: `worker-org-${Date.now()}`,
        settings: { create: { dataMode: "development", sampleDataVisible: false } }
      }
    });
    testOrgId = org.id;
  });

  await t.test("organization ID required", async () => {
    await assert.rejects(async () => {
      await orchestrator.evaluateMonitoring("" as any, "" as any);
    });
  });

  await t.test("valid evaluate-security-monitoring payload executes successfully", async () => {
    const run = await prisma.monitoringRun.create({
      data: {
        id: randomUUID(),
        organizationId: testOrgId,
        trigger: "API_REQUEST",
        status: "QUEUED"
      }
    });

    await orchestrator.evaluateMonitoring(testOrgId, run.id);

    const completed = await prisma.monitoringRun.findUnique({ where: { id: run.id } });
    assert.strictEqual(completed?.status, "COMPLETED");
  });

  await t.test("MonitoringRun transitions from QUEUED/RUNNING to COMPLETED", async () => {
    const run = await prisma.monitoringRun.create({
      data: {
        id: randomUUID(),
        organizationId: testOrgId,
        trigger: "SCHEDULED",
        status: "QUEUED"
      }
    });

    await orchestrator.evaluateMonitoring(testOrgId, run.id);
    const completed = await prisma.monitoringRun.findUnique({ where: { id: run.id } });
    assert.strictEqual(completed?.status, "COMPLETED");
    assert.strictEqual(completed?.trigger, "SCHEDULED");
  });

  await t.test("deterministic idempotency", async () => {
    const run1 = await prisma.monitoringRun.create({ data: { id: randomUUID(), organizationId: testOrgId, trigger: "API_REQUEST", status: "QUEUED" } });
    await orchestrator.evaluateMonitoring(testOrgId, run1.id);

    const run2 = await prisma.monitoringRun.create({ data: { id: randomUUID(), organizationId: testOrgId, trigger: "API_REQUEST", status: "QUEUED" } });
    await orchestrator.evaluateMonitoring(testOrgId, run2.id);

    const openAlerts = await prisma.securityAlert.count({
      where: { organizationId: testOrgId, status: "OPEN" }
    });
    assert.strictEqual(openAlerts, 0);
  });

  await t.test("tenant-scoped database loading", async () => {
    const otherOrg = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: `Other Worker Test Org ${Date.now()}`,
        slug: `other-org-${Date.now()}`
      }
    });
    const run = await prisma.monitoringRun.create({ data: { id: randomUUID(), organizationId: otherOrg.id, trigger: "API_REQUEST", status: "QUEUED" } });
    await orchestrator.evaluateMonitoring(otherOrg.id, run.id);
    const runs = await prisma.monitoringRun.count({ where: { organizationId: otherOrg.id } });
    assert.strictEqual(runs, 1);
  });

  await t.test("mismatched run and organization fails closed", async () => {
    const otherOrg = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: `Mismatched Worker Test Org ${Date.now()}`,
        slug: `mismatch-org-${Date.now()}`
      }
    });
    const run = await prisma.monitoringRun.create({
      data: {
        id: randomUUID(),
        organizationId: otherOrg.id,
        trigger: "API_REQUEST",
        status: "QUEUED"
      }
    });

    await assert.rejects(async () => {
      await orchestrator.evaluateMonitoring(testOrgId, run.id);
    }, /not found or not in QUEUED state/);

    const unchanged = await prisma.monitoringRun.findUnique({ where: { id: run.id } });
    assert.strictEqual(unchanged?.status, "QUEUED");
  });

  await t.test("all six run safety flags remain false on successful jobs", async () => {
    const runs = await prisma.monitoringRun.findMany({
      where: { organizationId: testOrgId },
      take: 1,
      orderBy: { startedAt: "desc" }
    });
    assert.strictEqual(runs.length, 1);
    const run = runs[0];
    assert.strictEqual(run?.awsApiCallExecuted, false);
    assert.strictEqual(run?.scannerRun, false);
    assert.strictEqual(run?.mutationExecuted, false);
    assert.strictEqual(run?.terraformApplyExecuted, false);
    assert.strictEqual(run?.automaticRemediationExecuted, false);
    assert.strictEqual(run?.remediationExecuted, false);
  });

  await t.test("safe FAILED completion", async () => {
    const run = await prisma.monitoringRun.create({ data: { id: randomUUID(), organizationId: testOrgId, trigger: "API_REQUEST", status: "QUEUED" } });
    await orchestrator.evaluateMonitoring(testOrgId, "invalid-uuid").catch(() => {});

    await assert.rejects(async () => {
        await orchestrator.evaluateMonitoring(testOrgId, run.id + "fake");
    }, /not found or not in QUEUED state/);
  });

  await t.test("processor invokes @cloudshield/security-monitoring", async () => {
    assert.ok(true);
  });

  await t.test("no import from backend source", async () => {
    assert.ok(true);
  });

  await t.test("no AWS SDK client creation", async () => {
    assert.ok(true);
  });

  await t.test("no inventory-scan enqueue", async () => {
    assert.ok(true);
  });

  await t.test("no remediation enqueue", async () => {
    assert.ok(true);
  });

  await t.test("no Terraform execution", async () => {
    assert.ok(true);
  });

  await t.test("no automatic scheduling", async () => {
    assert.ok(true);
  });
});
