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
import { CheckCircle2, CircleDashed, ArrowRight } from "lucide-react";

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
        <div className="mb-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-line bg-white p-5">
              <h3 className="text-sm font-semibold text-ink mb-4">Onboarding Readiness</h3>
              <div className="space-y-3">
                {readiness.awsAccounts.map(acc => (
                  <div key={acc.accountId} className="flex items-center justify-between p-3 border border-slate-100 rounded bg-slate-50">
                    <div>
                      <div className="text-sm font-semibold text-ink">{acc.name}</div>
                      <div className="text-xs text-slate-500">
                        {acc.environment} | Regions: {acc.regionCoverage.join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {acc.onboardingComplete ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                          <CheckCircle2 size={14} /> Ready
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          <CircleDashed size={14} /> Incomplete
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-line bg-white p-5">
              <h3 className="text-sm font-semibold text-ink mb-4">What to configure next</h3>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <div className="mt-0.5"><CircleDashed size={18} className="text-amber-500" /></div>
                  <div>
                    <p className="text-sm font-semibold text-ink">Configure AWS Connector</p>
                    <p className="text-xs text-slate-600 mt-1">Use IAM role assumption with environment variables for read-only STS validation readiness.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="mt-0.5"><CircleDashed size={18} className="text-amber-500" /></div>
                  <div>
                    <p className="text-sm font-semibold text-ink">Enable Inventory Scanner</p>
                    <p className="text-xs text-slate-600 mt-1">Scanner execution remains disabled by default and is separate from credential readiness.</p>
                  </div>
                </li>
              </ul>
              <div className="mt-5 pt-4 border-t border-line">
                <button className="flex items-center gap-2 text-sm font-semibold text-signal hover:text-signal-dark transition-colors">
                  View documentation <ArrowRight size={16} />
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
    <section className="rounded-md border border-line bg-white p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">AWS Credential Readiness</h3>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
            No credentials are stored in CloudShield DB. Use environment variables locally and
            secret manager/IAM role assumption in production. Access keys are optional local-dev
            fallback only and are not recommended for production.
          </p>
        </div>
        <span className="rounded-md border border-line bg-panel px-3 py-2 text-xs font-semibold text-slate-700">
          {readiness.credentialStorageMode}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <ReadinessTile label="Connector mode" value={readiness.connectorMode} />
        <ReadinessTile label="Scanner mode" value={readiness.scannerMode} />
        <ReadinessTile label="Role-based setup" value={readiness.roleBasedReadiness ? "ready" : "not ready"} />
        <ReadinessTile label="STS validation" value={readiness.stsValidationAvailable ? "available" : "not available"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-md border border-line p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Environment checklist</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {envChecks.map(([label, configured]) => (
              <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2" key={label}>
                <span className="text-xs font-semibold text-slate-600">{label}</span>
                <span className={`text-xs font-semibold ${configured ? "text-emerald-700" : "text-amber-700"}`}>
                  {configured ? "configured" : "missing"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-line p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Safety posture</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>No AWS API call executed: {String(readiness.awsApiCallExecuted)}</li>
            <li>No AWS mutation: {String(readiness.mutationEnabled)}</li>
            <li>No Terraform apply: {String(readiness.terraformApplyEnabled)}</li>
            <li>No automatic remediation: {String(readiness.remediationExecutionEnabled)}</li>
            <li>Local access-key fallback detected: {String(readiness.localAccessKeyFallbackDetected)}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function ReadinessTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
