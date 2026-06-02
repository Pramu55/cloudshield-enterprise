"use client";

import type {
  AwsAccountDto,
  AwsAccountListResponse,
  AwsConnectorStatusResponse,
  AwsSetupGuideResponse
} from "@cloudshield/contracts";
import { useEffect, useState } from "react";
import { RefreshBadge, fetchCloudShieldClient } from "../../../lib/client-api";
import { DashboardPage } from "../shared";
import { AccountRegistryClient } from "./registry-client";

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

export default function AccountsPage() {
  const [accounts, setAccounts] = useState(InstantAccounts);
  const [setupGuide, setSetupGuide] = useState(InstantSetupGuide);
  const [connectorStatus, setConnectorStatus] = useState(InstantConnectorStatus);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    Promise.all([
      fetchCloudShieldClient<AwsAccountListResponse>("/api/v1/aws/accounts"),
      fetchCloudShieldClient<AwsSetupGuideResponse>("/api/v1/aws/setup-guide"),
      fetchCloudShieldClient<AwsConnectorStatusResponse>("/api/v1/aws/connector/status")
    ])
      .then(([accountResponse, guideResponse, connectorResponse]) => {
        if (!isActive) {
          return;
        }

        setAccounts(accountResponse.items);
        setSetupGuide(guideResponse);
        setConnectorStatus(connectorResponse);
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
      <AccountRegistryClient
        initialAccounts={accounts}
        setupGuide={setupGuide}
        connectorStatus={connectorStatus}
      />
    </DashboardPage>
  );
}
