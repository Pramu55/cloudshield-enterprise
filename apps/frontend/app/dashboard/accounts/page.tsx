import type {
  AwsAccountListResponse,
  AwsConnectorStatusResponse,
  AwsSetupGuideResponse
} from "@cloudshield/contracts";
import { EmptyState, fetchCloudShield } from "../../../lib/api";
import { DashboardPage } from "../shared";
import { AccountRegistryClient } from "./registry-client";

export default async function AccountsPage() {
  const [accounts, setupGuide, connectorStatus] = await Promise.all([
    fetchCloudShield<AwsAccountListResponse>("/api/v1/aws/accounts"),
    fetchCloudShield<AwsSetupGuideResponse>("/api/v1/aws/setup-guide"),
    fetchCloudShield<AwsConnectorStatusResponse>("/api/v1/aws/connector/status")
  ]);

  return (
    <DashboardPage
      title="AWS Account Governance"
      description="Organization-scoped AWS account control plane for ownership, environment context, read-only validation posture, and governance metadata."
    >
      {!accounts || !setupGuide || !connectorStatus ? (
        <EmptyState label="Log in to manage AWS account registry metadata." />
      ) : (
        <AccountRegistryClient
          initialAccounts={accounts.items}
          setupGuide={setupGuide}
          connectorStatus={connectorStatus}
        />
      )}
    </DashboardPage>
  );
}
