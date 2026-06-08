import { describe, it } from "node:test";
import assert from "node:assert";
import { MonitoringEngine, MonitoringEvaluationInput } from "./monitoring.engine.js";

describe("MonitoringEngine", () => {
  const engine = new MonitoringEngine();
  const baseInput: MonitoringEvaluationInput = {
    organizationId: "org-1",
    accounts: [],
    criticalFindings: [],
    publicExposureFindings: [],
    failedScans: [],
    currentHighCount: 0,
    currentHighFindings: [],
    currentCompliances: [],
  };

  describe("High-finding increase", () => {
    it("first run establishes baseline and creates no increase alert", () => {
      const input = { ...baseInput, currentHighCount: 5 };
      const alerts = engine.evaluateRules(input);
      assert.strictEqual(alerts.some(a => a.ruleKey === "HIGH_SECURITY_FINDING_INCREASE"), false);
    });

    it("unchanged count creates no alert", () => {
      const input = {
        ...baseInput,
        currentHighCount: 5,
        previousSnapshot: {
          accountState: {} as any,
          findingFingerprints: [],
          complianceStates: [],
          postureSummary: { totalResourceCount: 10, criticalFindingCount: 0, highFindingCount: 5, mediumFindingCount: 0, lowFindingCount: 0 }
        }
      };
      const alerts = engine.evaluateRules(input);
      assert.strictEqual(alerts.some(a => a.ruleKey === "HIGH_SECURITY_FINDING_INCREASE"), false);
    });

    it("decreased count creates no increase alert", () => {
      const input = {
        ...baseInput,
        currentHighCount: 3,
        previousSnapshot: {
          accountState: {} as any,
          findingFingerprints: [],
          complianceStates: [],
          postureSummary: { totalResourceCount: 10, criticalFindingCount: 0, highFindingCount: 5, mediumFindingCount: 0, lowFindingCount: 0 }
        }
      };
      const alerts = engine.evaluateRules(input);
      assert.strictEqual(alerts.some(a => a.ruleKey === "HIGH_SECURITY_FINDING_INCREASE"), false);
    });

    it("increased count creates one alert", () => {
      const input = {
        ...baseInput,
        currentHighCount: 7,
        previousSnapshot: {
          accountState: {} as any,
          findingFingerprints: [],
          complianceStates: [],
          postureSummary: { totalResourceCount: 10, criticalFindingCount: 0, highFindingCount: 5, mediumFindingCount: 0, lowFindingCount: 0 }
        }
      };
      const alerts = engine.evaluateRules(input);
      const increaseAlerts = alerts.filter(a => a.ruleKey === "HIGH_SECURITY_FINDING_INCREASE");
      assert.strictEqual(increaseAlerts.length, 1);
      assert.strictEqual(increaseAlerts[0].evidence.previousCount, 5);
      assert.strictEqual(increaseAlerts[0].evidence.currentCount, 7);
      assert.strictEqual(increaseAlerts[0].evidence.increaseAmount, 2);
    });

    it("repeated evaluation creates no duplicate - handled by orchestrator dedupeKey", () => {
      // The orchestrator handles deduplication logic. The engine should reliably return the same dedupeKey
      const input = {
        ...baseInput,
        currentHighCount: 7,
        previousSnapshot: {
          accountState: {} as any,
          findingFingerprints: [],
          complianceStates: [],
          postureSummary: { totalResourceCount: 10, criticalFindingCount: 0, highFindingCount: 5, mediumFindingCount: 0, lowFindingCount: 0 }
        }
      };
      const alerts1 = engine.evaluateRules(input);
      const alerts2 = engine.evaluateRules(input);
      assert.strictEqual(alerts1.find(a => a.ruleKey === "HIGH_SECURITY_FINDING_INCREASE")?.dedupeKey, alerts2.find(a => a.ruleKey === "HIGH_SECURITY_FINDING_INCREASE")?.dedupeKey);
    });
  });

  describe("Compliance regression", () => {
    it("PASS -> FAIL creates an alert", () => {
      const input = {
        ...baseInput,
        currentCompliances: [{ controlId: "ctl-1", status: "FAIL" }],
        previousSnapshot: {
          accountState: {} as any,
          findingFingerprints: [],
          complianceStates: [{ controlId: "ctl-1", status: "PASS" }] as any,
          postureSummary: { totalResourceCount: 10, criticalFindingCount: 0, highFindingCount: 0, mediumFindingCount: 0, lowFindingCount: 0 }
        }
      };
      const alerts = engine.evaluateRules(input);
      assert.strictEqual(alerts.filter(a => a.ruleKey === "COMPLIANCE_CONTROL_REGRESSED").length, 1);
    });

    it("UNKNOWN -> FAIL does not create an alert", () => {
      const input = {
        ...baseInput,
        currentCompliances: [{ controlId: "ctl-1", status: "FAIL" }],
        previousSnapshot: {
          accountState: {} as any,
          findingFingerprints: [],
          complianceStates: [{ controlId: "ctl-1", status: "UNKNOWN" }] as any,
          postureSummary: { totalResourceCount: 10, criticalFindingCount: 0, highFindingCount: 0, mediumFindingCount: 0, lowFindingCount: 0 }
        }
      };
      const alerts = engine.evaluateRules(input);
      assert.strictEqual(alerts.some(a => a.ruleKey === "COMPLIANCE_CONTROL_REGRESSED"), false);
    });

    it("missing previous state -> FAIL does not create an alert", () => {
      const input = {
        ...baseInput,
        currentCompliances: [{ controlId: "ctl-1", status: "FAIL" }],
        previousSnapshot: {
          accountState: {} as any,
          findingFingerprints: [],
          complianceStates: [],
          postureSummary: { totalResourceCount: 10, criticalFindingCount: 0, highFindingCount: 0, mediumFindingCount: 0, lowFindingCount: 0 }
        }
      };
      const alerts = engine.evaluateRules(input);
      assert.strictEqual(alerts.some(a => a.ruleKey === "COMPLIANCE_CONTROL_REGRESSED"), false);
    });

    it("NOT_APPLICABLE -> FAIL does not create an alert", () => {
      const input = {
        ...baseInput,
        currentCompliances: [{ controlId: "ctl-1", status: "FAIL" }],
        previousSnapshot: {
          accountState: {} as any,
          findingFingerprints: [],
          complianceStates: [{ controlId: "ctl-1", status: "NOT_APPLICABLE" }] as any,
          postureSummary: { totalResourceCount: 10, criticalFindingCount: 0, highFindingCount: 0, mediumFindingCount: 0, lowFindingCount: 0 }
        }
      };
      const alerts = engine.evaluateRules(input);
      assert.strictEqual(alerts.some(a => a.ruleKey === "COMPLIANCE_CONTROL_REGRESSED"), false);
    });

    it("unchanged FAIL creates no duplicate - handled by orchestrator dedupeKey", () => {
       const input = {
        ...baseInput,
        currentCompliances: [{ controlId: "ctl-1", status: "FAIL" }],
        previousSnapshot: {
          accountState: {} as any,
          findingFingerprints: [],
          complianceStates: [{ controlId: "ctl-1", status: "FAIL" }] as any,
          postureSummary: { totalResourceCount: 10, criticalFindingCount: 0, highFindingCount: 0, mediumFindingCount: 0, lowFindingCount: 0 }
        }
      };
      const alerts = engine.evaluateRules(input);
      assert.strictEqual(alerts.some(a => a.ruleKey === "COMPLIANCE_CONTROL_REGRESSED"), false);
    });
  });

  describe("Account degradation", () => {
    it("previously connected -> degraded creates an alert", () => {
      const input = {
        ...baseInput,
        accounts: [{ id: "acc-1", connectionStatus: "VALIDATION_FAILED", status: "CONFIGURED", lastScanAt: new Date() } as any],
        previousSnapshot: {
          accountState: { "acc-1": { accountId: "acc-1", connectionStatus: "CONNECTED", status: "CONFIGURED", lastScanAt: null, scanStatus: null } as any },
          findingFingerprints: [],
          complianceStates: [],
          postureSummary: { totalResourceCount: 10, criticalFindingCount: 0, highFindingCount: 0, mediumFindingCount: 0, lowFindingCount: 0 }
        }
      };
      const alerts = engine.evaluateRules(input);
      assert.strictEqual(alerts.filter(a => a.ruleKey === "ACCOUNT_CONNECTIVITY_DEGRADED").length, 1);
    });

    it("never configured does not create an alert", () => {
      const input = {
        ...baseInput,
        accounts: [{ id: "acc-1", connectionStatus: "FAILED", status: "NOT_CONFIGURED", lastScanAt: null } as any],
      };
      const alerts = engine.evaluateRules(input);
      assert.strictEqual(alerts.some(a => a.ruleKey === "ACCOUNT_CONNECTIVITY_DEGRADED"), false);
    });
  });
});
