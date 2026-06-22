"use client";

import React, { useId } from "react";
import type { ActionCapability, RestrictionLayer } from "../../lib/action-capability";

const layerTitles: Record<RestrictionLayer, string> = {
  PERMISSION: "Permission restriction",
  POLICY: "Policy prerequisite",
  ENVIRONMENT: "Production restriction",
  RUNTIME_MODE: "Deployment restriction"
};

export function CapabilityNotice({ capability, title }: { capability: ActionCapability; title?: string }) {
  if (capability.allowed || !capability.safeExplanation || !capability.restrictionLayer) return null;
  return (
    <aside className="cs-notice p-5" data-tone="info" role="note">
      <strong>{title ?? layerTitles[capability.restrictionLayer]}</strong>
      <p>{capability.safeExplanation}</p>
      {capability.readOnlyAvailable ? <p>Safe read-only information remains available.</p> : null}
    </aside>
  );
}

export function GuardedAction({ capability, children, className = "cs-button-secondary", disabled = false, onClick, type = "button" }: {
  capability: ActionCapability;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const generatedId = useId().replace(/:/g, "");
  const explanationId = `guarded-action-${generatedId}`;

  if (!capability.allowed && (capability.restrictionLayer === "ENVIRONMENT" || capability.restrictionLayer === "RUNTIME_MODE")) {
    return <CapabilityNotice capability={capability} />;
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        aria-describedby={capability.allowed ? undefined : explanationId}
        aria-disabled={!capability.allowed || disabled}
        className={className}
        disabled={!capability.allowed || disabled}
        onClick={capability.allowed && !disabled ? onClick : undefined}
        type={type}
      >
        {children}
      </button>
      {!capability.allowed && capability.safeExplanation ? <span className="text-xs text-slate-600" id={explanationId}>{capability.safeExplanation}</span> : null}
    </span>
  );
}

export function PermissionRestriction({ capability }: { capability: ActionCapability }) {
  return capability.restrictionLayer === "PERMISSION" ? <CapabilityNotice capability={capability} /> : null;
}

export function PolicyRestriction({ capability }: { capability: ActionCapability }) {
  return capability.restrictionLayer === "POLICY" ? <CapabilityNotice capability={capability} /> : null;
}

export function ProductionRestrictionNotice() {
  return <CapabilityNotice capability={{ allowed: false, blockedReason: "PRODUCTION_RESTRICTED", restrictionLayer: "ENVIRONMENT", safeExplanation: "Production mutation is intentionally unavailable. Read-only assessment, evidence and audit data remain available.", readOnlyAvailable: true }} />;
}

export function RuntimeModeRestrictionNotice() {
  return <CapabilityNotice capability={{ allowed: false, blockedReason: "EXECUTION_MODE_DISABLED", restrictionLayer: "RUNTIME_MODE", safeExplanation: "Mutation is globally disabled in this deployment. Read-only capabilities remain available.", readOnlyAvailable: true }} />;
}
