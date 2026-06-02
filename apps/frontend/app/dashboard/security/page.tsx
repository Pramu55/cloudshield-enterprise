"use client";

import { useState } from "react";
import { ShieldAlert, Play, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { DashboardPage } from "../shared";
import { SampleDataNotice } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData, fetchCloudShieldClient } from "../../../lib/client-api";

type SecurityRule = {
  ruleId: string;
  title: string;
  description: string;
  severity: string;
  resourceTypes: string[];
  complianceRefs: string[];
  enabled: boolean;
  mutationRequired: boolean;
};

type SecurityRulesResponse = {
  rules: SecurityRule[];
  message: string;
};

type SecurityFinding = {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  evidence: Record<string, unknown>;
  businessImpact: string | null;
  recommendation: string | null;
  complianceRefs: string[];
  resourceName: string | null;
  resourceType: string | null;
  awsAccountName: string | null;
  ownerTeamName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

type SecurityFindingsResponse = {
  sampleData: boolean;
  sampleDataLabel: string;
  items: SecurityFinding[];
  awsApiCallExecuted: false;
  mutationExecuted: false;
};

type EvalResponse = {
  evaluatedResourceCount: number;
  findingsCreated: number;
  findingsUpdated: number;
  findingsResolved: number;
  awsApiCallExecuted: false;
  mutationExecuted: false;
  message: string;
};

const InstantRules: SecurityRulesResponse = {
  rules: [
    { ruleId: "SG_OPEN_SSH_TO_WORLD", title: "Security group allows SSH from 0.0.0.0/0", description: "Detects open SSH access.", severity: "HIGH", resourceTypes: ["security-group"], complianceRefs: ["CIS-inspired 5.2"], enabled: true, mutationRequired: false },
    { ruleId: "SG_OPEN_RDP_TO_WORLD", title: "Security group allows RDP from 0.0.0.0/0", description: "Detects open RDP access.", severity: "HIGH", resourceTypes: ["security-group"], complianceRefs: ["CIS-inspired 5.3"], enabled: true, mutationRequired: false },
    { ruleId: "EC2_PUBLIC_IP_PRESENT", title: "EC2 instance has public IP", description: "Detects public IP.", severity: "MEDIUM", resourceTypes: ["ec2-instance"], complianceRefs: ["CIS-inspired 5.1"], enabled: true, mutationRequired: false },
    { ruleId: "EBS_UNENCRYPTED", title: "EBS volume not encrypted", description: "Detects unencrypted EBS.", severity: "MEDIUM", resourceTypes: ["ebs-volume"], complianceRefs: ["CIS-inspired 2.1.1"], enabled: true, mutationRequired: false },
    { ruleId: "MISSING_OWNER_TAG", title: "Resource missing owner tag", description: "Missing owner.", severity: "LOW", resourceTypes: ["*"], complianceRefs: ["CIS-inspired tagging"], enabled: true, mutationRequired: false },
    { ruleId: "MISSING_ENVIRONMENT_TAG", title: "Resource missing environment tag", description: "Missing environment.", severity: "LOW", resourceTypes: ["*"], complianceRefs: ["CIS-inspired tagging"], enabled: true, mutationRequired: false },
    { ruleId: "PUBLIC_NETWORK_WITH_COMPUTE_ATTACHMENT", title: "EC2 with risky public SG", description: "Public compute exposure.", severity: "HIGH", resourceTypes: ["ec2-instance"], complianceRefs: ["CIS-inspired 5.4"], enabled: true, mutationRequired: false }
  ],
  message: "Instant rules catalog"
};

const InstantFindings: SecurityFindingsResponse = {
  sampleData: true,
  sampleDataLabel: "Findings are evaluated from CloudShield inventory records.",
  items: [],
  awsApiCallExecuted: false,
  mutationExecuted: false
};

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
  LOW: "bg-blue-100 text-blue-700 border-blue-300",
  INFO: "bg-slate-100 text-slate-600 border-slate-300"
};

export default function SecurityPage() {
  const { data: rulesData, error: rulesError, isRefreshing: rulesRefreshing } = useCloudShieldData<SecurityRulesResponse>("/api/v1/security/rules", InstantRules);
  const { data: findingsData, error: findingsError, isRefreshing: findingsRefreshing } = useCloudShieldData<SecurityFindingsResponse>("/api/v1/security/findings", InstantFindings);

  const [evalResult, setEvalResult] = useState<EvalResponse | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    setEvalLoading(true);
    setEvalError(null);
    try {
      const res = await fetchCloudShieldClient<EvalResponse>("/api/v1/security/evaluate", { method: "POST" });
      setEvalResult(res);
    } catch {
      setEvalError("Evaluation failed. Check backend connection.");
    } finally {
      setEvalLoading(false);
    }
  };

  // Severity summary
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of findingsData.items) {
    if (f.status === "OPEN" || f.status === "ACKNOWLEDGED" || f.status === "ASSIGNED") {
      severityCounts[f.severity as keyof typeof severityCounts] = (severityCounts[f.severity as keyof typeof severityCounts] || 0) + 1;
    }
  }

  return (
    <DashboardPage
      title="Security Posture Rules"
      description="Deterministic security posture rules evaluate CloudShield inventory records. No AWS scan is triggered by rule evaluation. No automatic remediation."
    >
      <SampleDataNotice />
      <RefreshBadge error={rulesError || findingsError} isRefreshing={rulesRefreshing || findingsRefreshing} />

      {/* Safety banner */}
      <section className="mb-6 rounded-md border border-sky-200 bg-sky-50 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          <div>
            <p className="text-sm font-semibold text-sky-900">Rules evaluate current CloudShield inventory records only. No AWS scan is triggered.</p>
            <p className="mt-1 text-xs text-sky-700">Compliance references are CIS-inspired and SOC2-inspired internal cloud governance controls. No official certification is claimed.</p>
          </div>
        </div>
      </section>

      {/* Evaluate button */}
      <section className="mb-6 flex flex-wrap items-center gap-4">
        <button
          onClick={handleEvaluate}
          disabled={evalLoading}
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          type="button"
        >
          <Play className="h-4 w-4" />
          {evalLoading ? "Evaluating..." : "Evaluate Security Rules"}
        </button>
        {evalResult && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {evalResult.message}
          </div>
        )}
        {evalError && (
          <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4" />
            {evalError}
          </div>
        )}
      </section>

      {/* Severity summary */}
      <section className="mb-6 grid gap-3 md:grid-cols-5">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((sev) => (
          <div key={sev} className={`rounded-md border p-3 ${SEVERITY_COLORS[sev]}`}>
            <p className="text-xs font-bold uppercase">{sev}</p>
            <p className="mt-1 text-2xl font-bold">{severityCounts[sev]}</p>
          </div>
        ))}
      </section>

      {/* Rules catalog */}
      <section className="mb-6 rounded-md border border-line bg-white p-5">
        <h3 className="text-sm font-semibold text-ink">Rules Catalog ({rulesData.rules.length} rules)</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Rule ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Resources</th>
                <th className="px-4 py-3">Mutation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rulesData.rules.map((rule) => (
                <tr key={rule.ruleId}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{rule.ruleId}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{rule.title}</td>
                  <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs font-bold ${SEVERITY_COLORS[rule.severity] || ""}`}>{rule.severity}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{rule.resourceTypes.join(", ")}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">None</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Findings */}
      <section className="rounded-md border border-line bg-white p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-alert" />
          <h3 className="text-sm font-semibold text-ink">Security Findings ({findingsData.items.length})</h3>
        </div>
        {findingsData.items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No security findings yet. Click &quot;Evaluate Security Rules&quot; to run deterministic rule evaluation against current inventory records.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {findingsData.items.map((finding) => (
              <div key={finding.id} className="rounded-md border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${SEVERITY_COLORS[finding.severity] || ""}`}>{finding.severity}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{finding.status}</span>
                  <span className="font-mono text-xs text-slate-500">{finding.ruleId}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">{finding.title}</p>
                <p className="mt-1 text-xs text-slate-600">{finding.description}</p>
                {finding.resourceName && <p className="mt-1 text-xs text-slate-500">Resource: {finding.resourceName} ({finding.resourceType})</p>}
                {finding.awsAccountName && <p className="text-xs text-slate-500">Account: {finding.awsAccountName}</p>}
                {finding.businessImpact && (
                  <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">
                    <span className="font-semibold">Business Impact:</span> {finding.businessImpact}
                  </div>
                )}
                {finding.recommendation && (
                  <div className="mt-1 rounded bg-emerald-50 p-2 text-xs text-emerald-800">
                    <span className="font-semibold">Recommendation:</span> {finding.recommendation}
                  </div>
                )}
                {finding.complianceRefs.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {finding.complianceRefs.map((ref) => (
                      <span key={ref} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{ref}</span>
                    ))}
                  </div>
                )}
                {finding.evidence && Object.keys(finding.evidence).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500">Evidence JSON</summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-600">{JSON.stringify(finding.evidence, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </DashboardPage>
  );
}
