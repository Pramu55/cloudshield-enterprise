import { REMEDIATION_BLOCKED_REASON } from "@cloudshield/contracts";

export const READ_ONLY_SAFETY_MODE = "read_only" as const;

export function recommendationExecutionPolicy() {
  return {
    canExecute: false as const,
    blockedReason: REMEDIATION_BLOCKED_REASON
  };
}

export function assertReadOnlyOperation(operation: string): void {
  if (!operation.startsWith("read:")) {
    throw new Error("CloudShield v1 only permits read-only foundation operations.");
  }
}
