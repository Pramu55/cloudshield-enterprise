import {
  Archive,
  Ban,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Info,
  ShieldAlert,
  TriangleAlert,
  XCircle
} from "lucide-react";
import { cn } from "../../lib/cn";
import {
  getSemanticStatus,
  mapBackendStatus,
  type SemanticStatusDefinition,
  type SemanticStatusKey,
  type StatusIconName
} from "../../lib/status";

const ICONS: Record<StatusIconName, typeof CheckCircle2> = {
  check: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  clock: Clock3,
  block: Ban,
  x: XCircle,
  archive: Archive,
  shield: ShieldAlert,
  help: CircleHelp
};

export interface StatusBadgeProps {
  status?: SemanticStatusKey;
  backendStatus?: unknown;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, backendStatus, label, className }: StatusBadgeProps) {
  const definition: SemanticStatusDefinition = status
    ? getSemanticStatus(status)
    : mapBackendStatus(backendStatus);
  const Icon = ICONS[definition.icon];

  return (
    <span
      className={cn(definition.className, className)}
      aria-label={label ? `${label}: ${definition.accessibleLabel}` : definition.accessibleLabel}
      data-severity={definition.severity}
    >
      <Icon aria-hidden="true" size={14} />
      <span>{label ?? definition.label}</span>
    </span>
  );
}
