import {
  AwsAccountInventoryPlanResponseSchema,
  AwsInventoryPlanResponseSchema,
  AwsInventoryStartBlockedResponseSchema,
  type AwsAccountDto,
  type AwsInventoryScannerMode
} from "@cloudshield/contracts";
import {
  BlockedAwsMutationPatterns,
  PlannedAwsInventoryResourceTypes,
  PlannedAwsInventoryScanPhases,
  PlannedAwsReadonlyApiOperations
} from "./aws-readonly-allowlist.js";

export class AwsInventoryPlanService {
  constructor(private readonly scannerMode: AwsInventoryScannerMode) {}

  getPlan() {
    return AwsInventoryPlanResponseSchema.parse({
      scannerMode: this.scannerMode,
      inventoryScanningEnabled: false,
      mutationEnabled: false,
      automaticRemediationEnabled: false,
      terraformApplyEnabled: false,
      awsApiCallExecuted: false,
      supportedResourceTypes: PlannedAwsInventoryResourceTypes,
      allowedReadOnlyApis: PlannedAwsReadonlyApiOperations,
      blockedMutationPatterns: BlockedAwsMutationPatterns,
      scanPhases: PlannedAwsInventoryScanPhases,
      sampleDataLabel:
        "Sample/demo planning data - real AWS inventory scanning is disabled.",
      message:
        "AWS inventory scanner architecture is planned, but scanner execution is disabled in this milestone."
    });
  }

  getAccountPlan(account: AwsAccountDto) {
    return AwsAccountInventoryPlanResponseSchema.parse({
      account,
      scannerMode: this.scannerMode,
      inventoryScanningEnabled: false,
      mutationEnabled: false,
      awsApiCallExecuted: false,
      regions: account.regions,
      plannedResourceTypes: PlannedAwsInventoryResourceTypes,
      plannedReadOnlyApis: PlannedAwsReadonlyApiOperations.filter(
        (operation) => operation.operation !== "GetCallerIdentity"
      ),
      message:
        "This account has a read-only inventory plan only. No EC2, S3, IAM, Security Group, EBS, VPC, or subnet inventory APIs were called."
    });
  }

  getBlockedStartResponse() {
    return AwsInventoryStartBlockedResponseSchema.parse({
      status: "BLOCKED_DISABLED",
      scannerMode: this.scannerMode,
      inventoryScanningEnabled: false,
      mutationEnabled: false,
      awsApiCallExecuted: false,
      blockedReason:
        "AWS inventory scanning is disabled in this CloudShield milestone.",
      message:
        "Start scan is blocked. CloudShield currently exposes the read-only scanner plan only and does not execute AWS inventory collection."
    });
  }
}
