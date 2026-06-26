import type { Prisma } from "@cloudshield/database";

export const AWS_ACCOUNT_LIFECYCLE_BLOCKED_ERROR = "aws_account_lifecycle_blocked";
export const AWS_ACCOUNT_LIFECYCLE_BLOCKED_MESSAGE =
  "Archived or disabled AWS account records cannot be used for operational workflows.";

export type AwsAccountLifecycleRecord = {
  archivedAt: Date | null;
  connectionStatus: string;
};

export function isAwsAccountOperationallyActive(
  account: AwsAccountLifecycleRecord
) {
  return !getAwsAccountOperationalBlockReason(account);
}

export function getAwsAccountOperationalBlockReason(
  account: AwsAccountLifecycleRecord
) {
  if (account.archivedAt) {
    return "AWS account registry record is archived.";
  }
  if (account.connectionStatus === "DISABLED") {
    return "AWS account registry record is disabled.";
  }
  return null;
}

export function awsAccountLifecycleBlockedResponse() {
  return {
    error: AWS_ACCOUNT_LIFECYCLE_BLOCKED_ERROR,
    message: AWS_ACCOUNT_LIFECYCLE_BLOCKED_MESSAGE,
    awsApiCallExecuted: false,
    scannerRun: false,
    mutationExecuted: false,
    terraformApplyExecuted: false,
    automaticRemediationExecuted: false
  };
}

export function activeAwsAccountWhere(
  organizationId: string,
  filters: Prisma.AwsAccountWhereInput = {}
): Prisma.AwsAccountWhereInput {
  return {
    AND: [
      { organizationId },
      { archivedAt: null },
      { NOT: { connectionStatus: "DISABLED" } },
      filters
    ]
  };
}

export function activeAwsAccountRelationWhere(): Prisma.AwsAccountWhereInput {
  return {
    archivedAt: null,
    NOT: { connectionStatus: "DISABLED" }
  };
}

export function activeCloudResourceWhere(
  organizationId: string,
  filters: Prisma.CloudResourceWhereInput = {}
): Prisma.CloudResourceWhereInput {
  return {
    AND: [
      { organizationId },
      { archivedAt: null },
      { awsAccount: activeAwsAccountRelationWhere() },
      filters
    ]
  };
}

export function activeSecurityFindingWhere(
  organizationId: string,
  filters: Prisma.SecurityFindingWhereInput = {}
): Prisma.SecurityFindingWhereInput {
  return {
    AND: [
      { organizationId },
      { archivedAt: null },
      { awsAccount: activeAwsAccountRelationWhere() },
      filters
    ]
  };
}

export function activeCostFindingWhere(
  organizationId: string,
  filters: Prisma.CostFindingWhereInput = {}
): Prisma.CostFindingWhereInput {
  return {
    AND: [
      { organizationId },
      { awsAccount: activeAwsAccountRelationWhere() },
      filters
    ]
  };
}

export function activeComplianceEvidenceWhere(
  organizationId: string,
  filters: Prisma.ComplianceEvidenceWhereInput = {}
): Prisma.ComplianceEvidenceWhereInput {
  return {
    AND: [
      { organizationId },
      {
        OR: [
          { resourceId: null },
          { resource: { awsAccount: activeAwsAccountRelationWhere() } }
        ]
      },
      filters
    ]
  };
}
