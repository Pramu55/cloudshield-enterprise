"use client";

import type {
  AwsAccountDto,
  AwsAccountListResponse,
  AwsConnectorStatusResponse,
  AwsInventoryPlanResponse,
  AwsSetupGuideResponse
} from "@cloudshield/contracts";
import { useEffect, useState } from "react";
import { RefreshBadge, fetchCloudShieldClient } from "../../../lib/client-api";
import { DashboardPage } from "../shared";
import { AccountRegistryClient } from "./registry-client";
import { CheckCircle2, CircleDashed, ArrowRight, ShieldAlert, KeyRound } from "lucide-react";

type ReadinessResponse = {
  awsAccounts: Array<{
    accountId: string;
    name: string;
    environment: string;
    regionCoverage: string[];
    connectorStatus: string;
    scannerStatus: string;
    onboardingComplete: boolean;
  }>;
  overallReadiness: string;
  credentialReadiness: AwsCredentialReadiness;
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

const now = new Date(0).toISOString();

const InstantAccounts: AwsAccountDto[] = [
  {
    id: "instant-account-1",
    name: "Demo Production Account",
    accountId: "111111111111",
    environment: "PRODUCTION",
    ownerTeamId: null,
    ownerTeamName: "Platform Engineering",
    regions: ["us-east-1", "us-west-2"],
    status: "NOT_CONFIGURED",
    connectionStatus: "DISABLED",
    lastScanAt: null,
    securityScore: 72,
    costScore: 81,
    complianceScore: 76,
    description: "Sample demo account record. No AWS inventory scanner has been executed.",
    roleArnPlaceholder: null,
    externalIdPlaceholder: null,
    setupInstructionsViewedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    sampleData: true
  },
  {
    id: "instant-account-2",
    name: "Demo Security Account",
    accountId: "222222222222",
    environment: "SECURITY",
    ownerTeamId: null,
    ownerTeamName: "Security Operations",
    regions: ["us-east-1"],
    status: "NOT_CONFIGURED",
    connectionStatus: "DISABLED",
    lastScanAt: null,
    securityScore: 88,
    costScore: 70,
    complianceScore: 84,
    description: "Sample governance registry metadata only.",
    roleArnPlaceholder: null,
    externalIdPlaceholder: null,
    setupInstructionsViewedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    sampleData: true
  }
];

const InstantSetupGuide: AwsSetupGuideResponse = {
  title: "AWS read-only connection plan",
  safetyMode: "read_only_planned",
  message:
    "CloudShield stores account governance metadata only. Real AWS inventory scanning is not enabled yet.",
  plannedConnectionModel: [
    "Use IAM role assumption with an external ID for future read-only validation.",
    "Keep AWS connector mode disabled unless validation is explicitly configured.",
    "Never store long-lived AWS access keys in CloudShield."
  ],
  currentLimitations: [
    "No AWS inventory scanner has been executed.",
    "No AWS mutation or automatic remediation is available.",
    "No official compliance certification is claimed."
  ],
  validation: {
    code: "VALIDATION_NOT_IMPLEMENTED",
    message:
      "Real AWS read-only validation will be added in the AWS read-only connector milestone. No AWS API calls were executed."
  }
};

const InstantConnectorStatus: AwsConnectorStatusResponse = {
  mode: "disabled",
  status: "DISABLED",
  enabled: false,
  configured: false,
  region: "us-east-1",
  roleArnConfigured: false,
  externalIdConfigured: false,
  allowedAwsCall: "none",
  inventoryScan: "not_enabled",
  mutationAccess: "not_enabled",
  message: "AWS connector mode is disabled. No AWS API calls were executed."
};

const InstantInventoryPlan: AwsInventoryPlanResponse = {
  scannerMode: "disabled",
  inventoryScanningEnabled: false,
  mutationEnabled: false,
  automaticRemediationEnabled: false,
  terraformApplyEnabled: false,
  awsApiCallExecuted: false,
  supportedResourceTypes: [
    "EC2_INSTANCE",
    "S3_BUCKET",
    "IAM_USER",
    "IAM_ROLE",
    "IAM_ACCESS_KEY",
    "SECURITY_GROUP",
    "EBS_VOLUME",
    "VPC",
    "SUBNET"
  ],
  allowedReadOnlyApis: [
    {
      service: "sts",
      operation: "GetCallerIdentity",
      resourceType: "AWS_ACCOUNT",
      category: "identity",
      riskLevel: "low",
      mutationAllowed: false,
      enabledInCurrentMilestone: true,
      notes: "Identity validation only when explicitly configured."
    },
    {
      service: "ec2",
      operation: "DescribeInstances",
      resourceType: "EC2_INSTANCE",
      category: "compute",
      riskLevel: "low",
      mutationAllowed: false,
      enabledInCurrentMilestone: false,
      notes: "Planned future read-only inventory API. Not executed yet."
    },
    {
      service: "s3",
      operation: "ListBuckets",
      resourceType: "S3_BUCKET",
      category: "storage",
      riskLevel: "low",
      mutationAllowed: false,
      enabledInCurrentMilestone: false,
      notes: "Planned future read-only inventory API. Not executed yet."
    },
    {
      service: "iam",
      operation: "ListRoles",
      resourceType: "IAM_ROLE",
      category: "iam",
      riskLevel: "medium",
      mutationAllowed: false,
      enabledInCurrentMilestone: false,
      notes: "Planned future read-only inventory API. Not executed yet."
    }
  ],
  blockedMutationPatterns: ["Create*", "Update*", "Delete*", "Put*", "Terraform apply"],
  scanPhases: [
    "Tenant-scoped account selection",
    "STS identity validation gate",
    "Disabled execution gate for this milestone"
  ],
  sampleDataLabel:
    "Sample/demo planning data - real AWS inventory scanning is disabled.",
  message:
    "AWS inventory scanner architecture is planned, but scanner execution is disabled in this milestone."
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState(InstantAccounts);
  const [setupGuide, setSetupGuide] = useState(InstantSetupGuide);
  const [connectorStatus, setConnectorStatus] = useState(InstantConnectorStatus);
  const [inventoryPlan, setInventoryPlan] = useState(InstantInventoryPlan);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    Promise.all([
      fetchCloudShieldClient<AwsAccountListResponse>("/api/v1/aws/accounts"),
      fetchCloudShieldClient<AwsSetupGuideResponse>("/api/v1/aws/setup-guide"),
      fetchCloudShieldClient<AwsConnectorStatusResponse>("/api/v1/aws/connector/status"),
      fetchCloudShieldClient<AwsInventoryPlanResponse>("/api/v1/aws/inventory/plan"),
      fetchCloudShieldClient<ReadinessResponse>("/api/v1/dashboard/readiness")
    ])
      .then(([accountResponse, guideResponse, connectorResponse, inventoryResponse, readinessResponse]) => {
        if (!isActive) {
          return;
        }

        setAccounts(accountResponse.items);
        setSetupGuide(guideResponse);
        setConnectorStatus(connectorResponse);
        setInventoryPlan(inventoryResponse);
        setReadiness(readinessResponse);
        setError(null);
      })
      .catch(() => {
        if (isActive) {
          setError("Showing instant account governance preview while the API refresh is unavailable.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsRefreshing(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <DashboardPage
      title="AWS Account Governance"
      description="Organization-scoped AWS account control plane for ownership, environment context, read-only validation posture, and governance metadata."
    >
      <RefreshBadge error={error} isRefreshing={isRefreshing} />
      
      {readiness && (
        <div className="mb-6 space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="premium-card p-5">
              <h3 className="text-sm font-bold text-ink mb-4">Onboarding Readiness</h3>
              <div className="space-y-3">
                {readiness.awsAccounts.map(acc => (
                  <div key={acc.accountId} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="text-sm font-bold text-ink">{acc.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {acc.environment} &bull; Regions: {acc.regionCoverage.join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {acc.onboardingComplete ? (
                        <span className="status-pill border-emerald-200 bg-emerald-50 text-emerald-700 py-0.5">
                          <CheckCircle2 size={13} /> Configured
                        </span>
                      ) : (
                        <span className="status-pill border-amber-200 bg-amber-50 text-amber-700 py-0.5">
                          <CircleDashed size={13} className="animate-spin" /> Incomplete
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="premium-card p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink mb-4">Setup Recommendation Checkpoints</h3>
                <ul className="space-y-4">
                  <li className="flex gap-3">
                    <div className="mt-0.5 text-amber-500"><CircleDashed size={16} /></div>
                    <div>
                      <p className="text-xs font-bold text-ink">Configure AWS Connector Mode</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Use IAM role assumption with environment variables for read-only STS validation readiness.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="mt-0.5 text-amber-500"><CircleDashed size={16} /></div>
                    <div>
                      <p className="text-xs font-bold text-ink">Enable Inventory Scanner Mode</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Scanner execution remains disabled by default and is separate from credential readiness.</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="mt-5 pt-4 border-t border-line">
                <button className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-transparent border-0 p-0 min-h-0">
                  Read Deployment Runbooks <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          <CredentialReadinessPanel readiness={readiness.credentialReadiness} />
        </div>
      )}

      <AccountRegistryClient
        initialAccounts={accounts}
        setupGuide={setupGuide}
        connectorStatus={connectorStatus}
        inventoryPlan={inventoryPlan}
      />
    </DashboardPage>
  );
}

function CredentialReadinessPanel({
  readiness
}: {
  readiness: AwsCredentialReadiness;
}) {
  const envChecks = [
    ["AWS_REGION", readiness.awsRegionConfigured],
    ["AWS_ROLE_ARN", readiness.awsRoleArnConfigured],
    ["AWS_EXTERNAL_ID", readiness.awsExternalIdConfigured],
    ["AWS_ACCOUNT_ID", readiness.awsAccountIdConfigured],
    ["AWS_CONNECTOR_MODE", readiness.connectorMode !== ""],
    ["AWS_INVENTORY_SCANNER_MODE", readiness.scannerMode !== ""]
  ] as const;

  return (
    <section className="premium-card p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-line pb-4 mb-5">
        <div className="flex gap-3 items-start">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <KeyRound size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">AWS Credential Readiness</h3>
            <p className="mt-1 max-w-4xl text-xs text-slate-500 leading-relaxed">
              No credentials are stored in CloudShield DB. Use environment variables locally and
              secret manager/IAM role assumption in production. Access keys are optional local-dev
              fallback only and are not recommended for production.
            </p>
          </div>
        </div>
        <span className="status-pill border-indigo-200 bg-indigo-50/50 text-indigo-700 py-1 text-xs self-start">
          Storage Mode: {readiness.credentialStorageMode}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <ReadinessTile label="Connector mode" value={readiness.connectorMode} />
        <ReadinessTile label="Scanner mode" value={readiness.scannerMode} />
        <ReadinessTile label="Role-based setup" value={readiness.roleBasedReadiness ? "ready" : "not ready"} />
        <ReadinessTile label="STS validation" value={readiness.stsValidationAvailable ? "available" : "not available"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="border border-line rounded-xl p-4 bg-slate-50/50">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Environment checklist</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {envChecks.map(([label, configured]) => (
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm" key={label}>
                <span className="text-[11px] font-mono text-slate-600 font-semibold">{label}</span>
                <span className={`status-pill py-0.5 text-[10px] ${configured ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  {configured ? "configured" : "missing"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-line rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Safety boundaries</p>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex justify-between border-b border-line/50 pb-1.5">
                <span>No AWS API call executed</span>
                <span className="font-bold text-emerald-600">{String(readiness.awsApiCallExecuted)}</span>
              </li>
              <li className="flex justify-between border-b border-line/50 pb-1.5">
                <span>No AWS mutation</span>
                <span className="font-bold text-emerald-600">{String(readiness.mutationEnabled)}</span>
              </li>
              <li className="flex justify-between border-b border-line/50 pb-1.5">
                <span>No Terraform apply</span>
                <span className="font-bold text-emerald-600">{String(readiness.terraformApplyEnabled)}</span>
              </li>
              <li className="flex justify-between">
                <span>No automatic remediation</span>
                <span className="font-bold text-emerald-600">{String(readiness.remediationExecutionEnabled)}</span>
              </li>
            </ul>
          </div>
          <div className="flex gap-2 items-center text-[10px] text-amber-700 mt-4 bg-amber-50 border border-amber-100 p-2 rounded-lg">
            <ShieldAlert size={14} className="shrink-0" />
            <span>Local access-key fallback is not recommended for production setups.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReadinessTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-slate-50/50 p-4 rounded-xl shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink capitalize">{value}</p>
    </div>
  );
}
