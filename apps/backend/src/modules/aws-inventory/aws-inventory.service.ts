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

  private getAllowedApis() {
    const isScannerEnabled = isReadonlyInventoryEnabled(this.scannerMode);
    return PlannedAwsReadonlyApiOperations.map(op => ({
      ...op,
      enabledInCurrentMilestone: op.enabledInCurrentMilestone && isScannerEnabled,
      notes: (isScannerEnabled && op.service === "ec2") 
        ? "Phase 1 read-only inventory sync is enabled for this allowlisted API."
        : op.notes
    }));
  }

  getPlan() {

    return AwsInventoryPlanResponseSchema.parse({
      scannerMode: this.scannerMode,
      inventoryScanningEnabled: isReadonlyInventoryEnabled(this.scannerMode),
      mutationEnabled: false,
      automaticRemediationEnabled: false,
      terraformApplyEnabled: false,
      awsApiCallExecuted: false,
      supportedResourceTypes: PlannedAwsInventoryResourceTypes,
      allowedReadOnlyApis: this.getAllowedApis(),
      blockedMutationPatterns: BlockedAwsMutationPatterns,
      scanPhases: PlannedAwsInventoryScanPhases,
      sampleDataLabel:
        "Sample/demo planning data - real AWS inventory scanning is disabled.",
      message:
        isReadonlyInventoryEnabled(this.scannerMode)
          ? "AWS read-only inventory sync is available only through explicit account-scoped sync."
          : "AWS inventory sync is disabled. No AWS inventory APIs will execute."
    });
  }

  getAccountPlan(account: AwsAccountDto) {
    return AwsAccountInventoryPlanResponseSchema.parse({
      account,
      scannerMode: this.scannerMode,
      inventoryScanningEnabled: isReadonlyInventoryEnabled(this.scannerMode),
      mutationEnabled: false,
      awsApiCallExecuted: false,
      regions: account.regions,
      plannedResourceTypes: PlannedAwsInventoryResourceTypes,
      plannedReadOnlyApis: this.getAllowedApis().filter(
        (operation) => operation.operation !== "GetCallerIdentity"
      ),
      message:
        isReadonlyInventoryEnabled(this.scannerMode)
          ? "This account can run explicit Phase 1 read-only inventory sync after STS account match."
          : "This account has a read-only inventory plan only. No AWS inventory APIs were called."
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
        "Start scan is blocked. CloudShield requires AWS_INVENTORY_SCANNER_MODE=readonly before AWS inventory collection."
    });
  }
}

export function isReadonlyInventoryEnabled(scannerMode: AwsInventoryScannerMode) {
  return scannerMode === "readonly" || scannerMode === "readonly-scan";
}
