"use client";

import { CommandCard, InsightPanel, ProgressBars, StatusMatrix, WorkspaceHero, DashboardPage } from "../shared";
import { useCloudShieldData, RefreshBadge } from "../../../lib/client-api";
import {
  Shield,
  Zap,
  Terminal,
  Wrench,
  Lock,
  Key,
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  Server,
  ShieldCheck,
  Radio,
  Gauge,
  Fingerprint,
  Settings,
} from "lucide-react";

type SafetySettings = {
  status: {
    mutationEnabled: boolean;
    remediationExecutionEnabled: boolean;
    awsScannerEnabled: boolean;
    terraformApplyEnabled: boolean;
    environmentMode: string;
    credentialReadiness: string;
    credentialReadinessDetails: AwsCredentialReadiness;
  };
  message: string;
};

type AwsCredentialReadiness = {
  connectorMode: string;
  scannerMode: string;
  requiredEnvPresent: boolean;
  missingEnvKeys: string[];
  awsRegionConfigured: boolean;
  awsRoleArnConfigured: boolean;
  awsExternalIdConfigured: boolean;
  awsAccountIdConfigured: boolean;
  awsAccessKeyIdConfigured: boolean;
  awsSecretAccessKeyConfigured: boolean;
  awsSessionTokenConfigured: boolean;
  roleBasedReadiness: boolean;
  localAccessKeyFallbackDetected: boolean;
  credentialStorageMode: "environment-only";
  secretManagerRecommended: true;
  stsValidationAvailable: boolean;
  inventoryScanAvailable: boolean;
  mutationEnabled: false;
  terraformApplyEnabled: false;
  remediationExecutionEnabled: false;
  awsApiCallExecuted: false;
  message: string;
};

const DefaultCredentialReadiness: AwsCredentialReadiness = {
  connectorMode: "disabled",
  scannerMode: "disabled",
  requiredEnvPresent: false,
  missingEnvKeys: ["AWS_REGION", "AWS_ROLE_ARN"],
  awsRegionConfigured: false,
  awsRoleArnConfigured: false,
  awsExternalIdConfigured: false,
  awsAccountIdConfigured: false,
  awsAccessKeyIdConfigured: false,
  awsSecretAccessKeyConfigured: false,
  awsSessionTokenConfigured: false,
  roleBasedReadiness: false,
  localAccessKeyFallbackDetected: false,
  credentialStorageMode: "environment-only",
  secretManagerRecommended: true,
  stsValidationAvailable: false,
  inventoryScanAvailable: false,
  mutationEnabled: false,
  terraformApplyEnabled: false,
  remediationExecutionEnabled: false,
  awsApiCallExecuted: false,
  message:
    "AWS credential readiness inspects environment variable presence only. No secret values are returned."
};

const DefaultSafety: SafetySettings = {
  status: {
    mutationEnabled: false,
    remediationExecutionEnabled: false,
    awsScannerEnabled: false,
    terraformApplyEnabled: false,
    environmentMode: "local-evaluator",
    credentialReadiness: "not-configured",
    credentialReadinessDetails: DefaultCredentialReadiness
  },
  message: "Safety guardrails are active."
};

export default function SettingsPage() {
  const { data, error, isRefreshing } = useCloudShieldData<SafetySettings>("/api/v1/settings/safety", DefaultSafety);

  const guardrails = [
    {
      label: "Mutation Mode",
      value: data.status.mutationEnabled,
      icon: Shield,
      description: "AWS resource mutation",
    },
    {
      label: "Automatic Remediation",
      value: data.status.remediationExecutionEnabled,
      icon: Zap,
      description: "Auto-fix execution",
    },
    {
      label: "AWS Scanner Execution",
      value: data.status.awsScannerEnabled,
      icon: Terminal,
      description: "Live inventory scan",
    },
    {
      label: "Terraform Apply",
      value: data.status.terraformApplyEnabled,
      icon: Wrench,
      description: "IaC apply operations",
    },
  ];

  const executionGates = [
    { label: "STS validation available", value: data.status.credentialReadinessDetails.stsValidationAvailable, icon: Fingerprint },
    { label: "Inventory scanner available", value: data.status.credentialReadinessDetails.inventoryScanAvailable, icon: Server },
    { label: "AWS API call executed", value: data.status.credentialReadinessDetails.awsApiCallExecuted, icon: Radio },
    { label: "AWS mutation enabled", value: data.status.credentialReadinessDetails.mutationEnabled, icon: Shield },
    { label: "Terraform apply enabled", value: data.status.credentialReadinessDetails.terraformApplyEnabled, icon: Wrench },
    { label: "Automatic remediation enabled", value: data.status.credentialReadinessDetails.remediationExecutionEnabled, icon: Zap },
  ];

  const crd = data.status.credentialReadinessDetails;

  return (
    <DashboardPage
      title="Settings & Safety Controls"
      description="Administration shell for governed operations, approval-based remediation planning, safety controls, and environment readiness."
    >
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <WorkspaceHero
        eyebrow="Admin and safety control center"
        title="Manage runtime guardrails, credential readiness, and production preparation."
        description="Settings is organized as an operations control room for environment storage, safety gates, read-only scanner mode, governed workflows, and deployment readiness."
        icon={<Settings size={20} />}
        badges={[
          { label: data.status.environmentMode, tone: "info" },
          { label: "AWS mutation disabled", tone: "good" },
          { label: "No secret fields", tone: "good" }
        ]}
      >
        <ProgressBars
          items={[
            { label: "Credential readiness", value: crd.requiredEnvPresent ? 100 : 42, tone: crd.requiredEnvPresent ? "good" : "warning" },
            { label: "Role-based setup", value: crd.roleBasedReadiness ? 100 : 34, tone: crd.roleBasedReadiness ? "good" : "warning" },
            { label: "Production gates", value: 62, tone: "info" }
          ]}
        />
      </WorkspaceHero>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel
          title="Safety gates grid"
          description="Dangerous execution remains blocked and cannot be enabled from the UI."
        >
          <StatusMatrix
            items={[
              { label: "AWS mutation", value: data.status.mutationEnabled, tone: data.status.mutationEnabled ? "danger" : "good" },
              { label: "Terraform apply", value: data.status.terraformApplyEnabled, tone: data.status.terraformApplyEnabled ? "danger" : "good" },
              { label: "Auto remediation", value: data.status.remediationExecutionEnabled, tone: data.status.remediationExecutionEnabled ? "danger" : "good" },
              { label: "Scanner requires mode", value: data.status.awsScannerEnabled ? "enabled" : "explicit config", tone: data.status.awsScannerEnabled ? "warning" : "good" }
            ]}
          />
        </InsightPanel>
        <InsightPanel
          title="Production readiness checklist"
          description="Operational prerequisites before live read-only usage."
        >
          <div className="grid gap-3">
            <CommandCard icon={<Key size={18} />} title="Role-based AWS setup" description="Use IAM role assumption and external ID. Avoid long-lived access keys." />
            <CommandCard icon={<Lock size={18} />} title="Secret storage model" description="Use environment variables locally and secret manager in production." />
            <CommandCard icon={<ShieldCheck size={18} />} title="Governed execution" description="Keep remediation approval, dry-run, rollback, and audit controls explicit." />
          </div>
        </InsightPanel>
      </section>

      <section className="premium-card mb-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Governed operations foundation</h3>
                <p className="text-xs text-slate-500">
                  Active workflow controls for remediation plans, approvals, manual completion, and audit evidence.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              CloudShield can now coordinate real operations work inside the platform: analysts can create remediation plans,
              request approval, approve or reject plans, and record manual execution completion. Dangerous cloud execution
              remains blocked until production policy, RBAC, dry-run, rollback, and tenant controls are added.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              "Remediation planning enabled",
              "Approval workflow enabled",
              "Audit events enabled",
              "Manual completion tracking enabled"
            ].map((item) => (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3" key={item}>
                <p className="text-xs font-bold text-emerald-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Platform Safety Guardrails ─── */}
      <section className="premium-card mb-6">
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #312e81 50%, #4f46e5 100%)",
            borderBottom: "3px solid #4f46e5",
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 36,
              height: 36,
              background: "rgba(129, 140, 248, 0.2)",
              border: "1px solid rgba(129, 140, 248, 0.35)",
            }}
          >
            <ShieldCheck size={18} className="text-indigo-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Platform Safety Guardrails
            </h3>
            <p className="text-xs text-indigo-300 mt-0.5">
              Runtime safety controls &amp; execution boundaries
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {guardrails.map((g) => {
              const Icon = g.icon;
              const safe = !g.value;
              return (
                <div
                  key={g.label}
                  className="group relative rounded-xl border bg-white p-4 transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    borderColor: safe ? "#d1fae5" : "#fecaca",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="flex items-center justify-center rounded-lg"
                      style={{
                        width: 32,
                        height: 32,
                        background: safe ? "#ecfdf5" : "#fef2f2",
                      }}
                    >
                      <Icon size={16} style={{ color: safe ? "#059669" : "#dc2626" }} />
                    </div>
                    <span
                      className="status-dot-pulse"
                      style={{ color: safe ? "#16a34a" : "#dc2626" }}
                    />
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {g.label}
                  </p>
                  <p
                    className="mt-1 text-sm font-bold"
                    style={{ color: safe ? "#059669" : "#dc2626" }}
                  >
                    {g.value ? "Enabled" : "Disabled"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{g.description}</p>
                </div>
              );
            })}
          </div>

          {/* Environment Mode & Credential Readiness row */}
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div
              className="rounded-xl border border-line bg-slate-50/60 p-4 transition-all duration-200 hover:-translate-y-0.5"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Gauge size={14} className="text-signal" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Environment Mode
                </p>
              </div>
              <p className="text-sm font-bold text-ink">
                {data.status.environmentMode}
              </p>
            </div>
            <div
              className="rounded-xl border border-line bg-slate-50/60 p-4 transition-all duration-200 hover:-translate-y-0.5"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Key size={14} className="text-signal" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Credentials
                </p>
              </div>
              <p className="text-sm font-bold text-ink">
                {data.status.credentialReadiness}
              </p>
            </div>
          </div>

          {/* Message info panel */}
          <div
            className="mt-5 flex items-start gap-3 rounded-lg p-4"
            style={{
              background: "#eef2ff",
              borderLeft: "3px solid #4f46e5",
            }}
          >
            <Info size={16} className="text-signal mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600 leading-relaxed">
              {data.message}
            </p>
          </div>
        </div>
      </section>

      {/* ─── AWS Credential Readiness ─── */}
      <section className="premium-card mb-6">
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, #0d9488 0%, #1e1b4b 60%, #4f46e5 100%)",
            borderBottom: "3px solid #0d9488",
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 36,
              height: 36,
              background: "rgba(94, 234, 212, 0.15)",
              border: "1px solid rgba(94, 234, 212, 0.3)",
            }}
          >
            <Key size={18} className="text-teal-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              AWS Credential Readiness
            </h3>
            <p className="text-xs text-teal-300 mt-0.5">
              Credential configuration &amp; environment posture
            </p>
          </div>
        </div>

        <div className="p-6">
          {/* No credentials stored banner */}
          <div
            className="flex items-start gap-3 rounded-xl p-4 mb-6"
            style={{
              background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%)",
              border: "1px solid #a7f3d0",
            }}
          >
            <Lock size={16} className="text-teal mt-0.5 shrink-0" />
            <p className="text-sm leading-6 text-slate-600">
              No credentials are stored in CloudShield DB. Use environment variables locally and
              secret manager/IAM role assumption in production. This page does not expose secret
              values and does not provide secret input fields.
            </p>
          </div>

          {/* Readiness cards grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <ReadinessCard
              label="Connector Mode"
              value={crd.connectorMode}
              icon={Radio}
              badgeColor={crd.connectorMode === "disabled" ? "#f59e0b" : "#4f46e5"}
            />
            <ReadinessCard
              label="Scanner Mode"
              value={crd.scannerMode}
              icon={Terminal}
              badgeColor={crd.scannerMode === "disabled" ? "#f59e0b" : "#4f46e5"}
            />
            <ReadinessCard
              label="Role-Based Readiness"
              value={crd.roleBasedReadiness ? "Ready" : "Not Ready"}
              icon={crd.roleBasedReadiness ? CheckCircle : XCircle}
              badgeColor={crd.roleBasedReadiness ? "#16a34a" : "#dc2626"}
            />
            <ReadinessCard
              label="Credential Storage"
              value={crd.credentialStorageMode}
              icon={Lock}
              badgeColor="#4f46e5"
            />
          </div>

          {/* Missing Env Keys & Execution Gates */}
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {/* ── Missing env keys ── */}
            <div className="premium-card">
              <div
                className="px-5 py-3 flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                  borderBottom: "2px solid #f59e0b",
                }}
              >
                <AlertTriangle size={15} style={{ color: "#d97706" }} />
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#92400e" }}>
                  Missing Recommended Env
                </p>
              </div>
              <div className="p-5">
                {crd.missingEnvKeys.length ? (
                  <div className="flex flex-wrap gap-2">
                    {crd.missingEnvKeys.map((key) => (
                      <span
                        className="status-pill"
                        key={key}
                        style={{
                          color: "#92400e",
                          background: "#fffbeb",
                          borderColor: "#fbbf24",
                          fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
                          fontSize: 12,
                          letterSpacing: "0.02em",
                        }}
                      >
                        <AlertTriangle size={11} />
                        {key}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-success" />
                    <p className="text-sm font-semibold text-emerald-700">
                      Recommended env keys detected.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Execution Gates ── */}
            <div className="premium-card">
              <div
                className="px-5 py-3 flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
                  borderBottom: "2px solid #4f46e5",
                }}
              >
                <Settings size={15} className="text-signal" />
                <p className="text-xs font-bold uppercase tracking-wider text-signal">
                  Execution Gates
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {executionGates.map((gate, i) => {
                  const GateIcon = gate.icon;
                  const boolVal = Boolean(gate.value);
                  return (
                    <div
                      key={gate.label}
                      className="flex items-center justify-between px-5 py-3 transition-colors duration-150"
                      style={{
                        background: i % 2 === 0 ? "#ffffff" : "#f8fafc",
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <GateIcon size={14} className="text-slate-400" />
                        <span className="text-sm text-slate-600">{gate.label}</span>
                      </div>
                      <span
                        className="status-pill"
                        style={{
                          color: boolVal ? "#dc2626" : "#16a34a",
                          background: boolVal ? "#fef2f2" : "#f0fdf4",
                          borderColor: boolVal ? "#fca5a5" : "#86efac",
                          fontSize: 11,
                          padding: "2px 10px",
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: boolVal ? "#dc2626" : "#16a34a",
                            display: "inline-block",
                          }}
                        />
                        {boolVal ? "true" : "false"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer Info Panel ─── */}
      <div
        className="flex items-start gap-3 rounded-xl p-5"
        style={{
          background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f0fdfa 100%)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: 32,
            height: 32,
            background: "#eef2ff",
            border: "1px solid #c7d2fe",
          }}
        >
          <Info size={15} className="text-signal" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Governed controls display</p>
          <p className="text-sm text-slate-500 leading-relaxed mt-1">
            Settings reflect the current runtime configuration. Governance workflows are active
            for CloudShield DB records. AWS mutation execution, Terraform apply, and automatic
            remediation cannot be enabled from this interface.
          </p>
        </div>
      </div>
    </DashboardPage>
  );
}

function ReadinessCard({
  label,
  value,
  icon: Icon,
  badgeColor,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  badgeColor: string;
}) {
  return (
    <div
      className="group rounded-xl border border-line bg-white p-4 transition-all duration-200 hover:-translate-y-0.5"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 32,
            height: 32,
            background: `${badgeColor}10`,
          }}
        >
          <Icon size={16} style={{ color: badgeColor }} />
        </div>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: badgeColor,
            display: "inline-block",
            boxShadow: `0 0 6px ${badgeColor}40`,
          }}
        />
      </div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1.5 text-sm font-bold" style={{ color: badgeColor }}>
        {value}
      </p>
    </div>
  );
}
