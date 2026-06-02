"use client";

import { DashboardPage } from "../shared";
import { useCloudShieldData, RefreshBadge } from "../../../lib/client-api";

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

  return (
    <DashboardPage
      title="Settings & Safety Controls"
      description="Administration shell for accounts, teams, required tags, severity policy, scan schedule, regions, and read-only connection status."
    >
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <section className="mb-6 rounded-md border border-line bg-white p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">Platform Safety Guardrails</h3>
        <p className="text-sm text-slate-600 mb-6">{data.message}</p>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Mutation Mode</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.mutationEnabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Automatic Remediation</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.remediationExecutionEnabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">AWS Scanner Execution</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.awsScannerEnabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Terraform Apply</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.terraformApplyEnabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Environment Mode</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.environmentMode}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Credentials</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.credentialReadiness}</p>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-line bg-white p-5">
        <h3 className="text-sm font-semibold text-ink mb-2">AWS Credential Readiness</h3>
        <p className="text-sm leading-6 text-slate-600">
          No credentials are stored in CloudShield DB. Use environment variables locally and
          secret manager/IAM role assumption in production. This page does not expose secret
          values and does not provide secret input fields.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SafetyCard label="Connector mode" value={data.status.credentialReadinessDetails.connectorMode} />
          <SafetyCard label="Scanner mode" value={data.status.credentialReadinessDetails.scannerMode} />
          <SafetyCard label="Role-based readiness" value={data.status.credentialReadinessDetails.roleBasedReadiness ? "ready" : "not ready"} />
          <SafetyCard label="Credential storage" value={data.status.credentialReadinessDetails.credentialStorageMode} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-line p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Missing recommended env</p>
            {data.status.credentialReadinessDetails.missingEnvKeys.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.status.credentialReadinessDetails.missingEnvKeys.map((key) => (
                  <span className="rounded-full border border-warning/40 bg-yellow-50 px-3 py-1 text-xs font-semibold text-slate-700" key={key}>
                    {key}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm font-semibold text-emerald-700">Recommended env keys detected.</p>
            )}
          </div>

          <div className="rounded-md border border-line p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Execution gates</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>STS validation available: {String(data.status.credentialReadinessDetails.stsValidationAvailable)}</li>
              <li>Inventory scanner available: {String(data.status.credentialReadinessDetails.inventoryScanAvailable)}</li>
              <li>AWS API call executed: {String(data.status.credentialReadinessDetails.awsApiCallExecuted)}</li>
              <li>AWS mutation enabled: {String(data.status.credentialReadinessDetails.mutationEnabled)}</li>
              <li>Terraform apply enabled: {String(data.status.credentialReadinessDetails.terraformApplyEnabled)}</li>
              <li>Automatic remediation enabled: {String(data.status.credentialReadinessDetails.remediationExecutionEnabled)}</li>
            </ul>
          </div>
        </div>
      </section>
    </DashboardPage>
  );
}

function SafetyCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
      <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-700">{value}</p>
    </div>
  );
}
