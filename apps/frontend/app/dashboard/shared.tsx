import type { ReactNode } from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Circle,
  Clock3,
  Info,
  Loader2,
  MinusCircle,
  XCircle
} from "lucide-react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "disabled";
type PanelVariant = "metric" | "operational" | "status" | "insight" | "warning" | "action" | "evidence" | "detail";

export type StatusKey =
  | "CONNECTED"
  | "NOT_CONFIGURED"
  | "READY"
  | "READY_FOR_VALIDATION"
  | "BLOCKED"
  | "RUNNING"
  | "STARTED"
  | "SUCCEEDED"
  | "COMPLETED"
  | "FAILED"
  | "PARTIAL"
  | "PARTIALLY_SUCCEEDED"
  | "DISABLED"
  | "PENDING"
  | "PENDING_APPROVAL"
  | "ARCHIVED"
  | "STALE"
  | "CONNECTOR_DISABLED"
  | "PARTIALLY_CONNECTED"
  | "STALE_INVENTORY"
  | "NEVER_VALIDATED"
  | "SYNC_BLOCKED"
  | "SYNC_FAILED"
  | "FRESH"
  | "AGING"
  | "NEVER_SYNCHRONIZED"
  | string;

const statusMap: Record<string, { label: string; tone: Tone; icon: ReactNode }> = {
  CONNECTED: { label: "Connected", tone: "success", icon: <CheckCircle2 size={13} /> },
  VALIDATION_SUCCEEDED: { label: "Verified", tone: "success", icon: <CheckCircle2 size={13} /> },
  NOT_CONFIGURED: { label: "Not configured", tone: "disabled", icon: <MinusCircle size={13} /> },
  READY: { label: "Ready", tone: "info", icon: <Info size={13} /> },
  READY_FOR_VALIDATION: { label: "Ready", tone: "info", icon: <Info size={13} /> },
  BLOCKED: { label: "Blocked", tone: "warning", icon: <AlertCircle size={13} /> },
  BLOCKED_DISABLED: { label: "Blocked", tone: "warning", icon: <AlertCircle size={13} /> },
  RUNNING: { label: "Running", tone: "info", icon: <Loader2 size={13} /> },
  STARTED: { label: "Running", tone: "info", icon: <Loader2 size={13} /> },
  SUCCEEDED: { label: "Succeeded", tone: "success", icon: <CheckCircle2 size={13} /> },
  COMPLETED: { label: "Completed", tone: "success", icon: <CheckCircle2 size={13} /> },
  FAILED: { label: "Failed", tone: "danger", icon: <XCircle size={13} /> },
  VALIDATION_FAILED: { label: "Failed", tone: "danger", icon: <XCircle size={13} /> },
  PARTIAL: { label: "Partial", tone: "warning", icon: <AlertCircle size={13} /> },
  PARTIALLY_SUCCEEDED: { label: "Partial", tone: "warning", icon: <AlertCircle size={13} /> },
  DISABLED: { label: "Disabled", tone: "disabled", icon: <MinusCircle size={13} /> },
  PENDING: { label: "Pending", tone: "warning", icon: <Clock3 size={13} /> },
  PENDING_APPROVAL: { label: "Pending approval", tone: "warning", icon: <Clock3 size={13} /> },
  ARCHIVED: { label: "Archived", tone: "disabled", icon: <Archive size={13} /> },
  STALE: { label: "Stale", tone: "warning", icon: <AlertCircle size={13} /> },
  CONNECTOR_DISABLED: { label: "Connector Disabled", tone: "disabled", icon: <MinusCircle size={13} /> },
  PARTIALLY_CONNECTED: { label: "Partially Connected", tone: "warning", icon: <AlertCircle size={13} /> },
  STALE_INVENTORY: { label: "Stale Inventory", tone: "warning", icon: <AlertCircle size={13} /> },
  NEVER_VALIDATED: { label: "Never Validated", tone: "disabled", icon: <MinusCircle size={13} /> },
  SYNC_BLOCKED: { label: "Sync Blocked", tone: "warning", icon: <AlertCircle size={13} /> },
  SYNC_FAILED: { label: "Sync Failed", tone: "danger", icon: <XCircle size={13} /> },
  FRESH: { label: "Fresh", tone: "success", icon: <CheckCircle2 size={13} /> },
  AGING: { label: "Aging", tone: "warning", icon: <Clock3 size={13} /> },
  NEVER_SYNCHRONIZED: { label: "Never Synchronized", tone: "disabled", icon: <MinusCircle size={13} /> }
};

export function getStatusMeta(status: StatusKey | null | undefined) {
  if (!status) return { label: "Data unavailable", tone: "disabled" as Tone, icon: <Circle size={13} /> };
  const normalized = String(status).toUpperCase();
  if (normalized === "UNKNOWN") {
    return { label: "Data unavailable", tone: "disabled" as Tone, icon: <Circle size={13} /> };
  }
  return statusMap[normalized] ?? {
    label: humanize(status),
    tone: "neutral" as Tone,
    icon: <Circle size={13} />
  };
}

export function StatusBadge({
  status,
  label
}: {
  status?: StatusKey | null;
  label?: string;
}) {
  const meta = getStatusMeta(status ?? label);
  return (
    <span className="cs-status" data-tone={meta.tone}>
      {meta.icon}
      {label ?? meta.label}
    </span>
  );
}

export function SourceBadge({ source }: { source?: string | null }) {
  const normalized = source || "UNKNOWN";
  return (
    <span className="cs-source" data-source={normalized === "AWS_SYNC" ? "aws" : normalized === "SAMPLE" ? "sample" : "other"}>
      {normalized === "AWS_SYNC" ? "AWS_SYNC" : normalized === "SAMPLE" ? "SAMPLE" : humanize(normalized)}
    </span>
  );
}

export function PageHeader({
  breadcrumbs = [],
  title,
  description,
  eyebrow,
  primaryAction,
  secondaryAction,
  status,
  meta
}: {
  breadcrumbs?: string[];
  title: string;
  description?: string;
  eyebrow?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  status?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="cs-page-header">
      <div className="min-w-0 flex-1">
        {breadcrumbs.length ? (
          <div className="cs-breadcrumbs mb-3" aria-label="Breadcrumb">
            {breadcrumbs.map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
        ) : null}
        {eyebrow ? <p className="cs-page-eyebrow">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-4">
          <h1>{title}</h1>
          {status}
        </div>
        {description ? <p className="mt-4">{description}</p> : null}
        {meta ? <div className="cs-page-meta">{meta}</div> : null}
      </div>
      {(primaryAction || secondaryAction) ? (
        <div className="cs-page-actions ml-6">
          {secondaryAction}
          {primaryAction}
        </div>
      ) : null}
    </header>
  );
}

export function Section({
  title,
  description,
  icon,
  variant = "detail",
  action,
  children,
  noPadding = false
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  variant?: PanelVariant;
  action?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
}) {
  return (
    <section className="cs-section" data-variant={variant}>
      <div className="cs-section-header">
        <div className="cs-section-title">
          {icon ? <span>{icon}</span> : null}
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className={noPadding ? "" : "p-5 lg:p-6"}>
        {children}
      </div>
    </section>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  tone = "neutral",
  icon,
  trend
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  trend?: ReactNode;
}) {
  return (
    <div className="cs-metric flex flex-col justify-between" data-tone={tone}>
      <div>
        <div className="cs-metric-top">
          <span>{label}</span>
          {icon ? <i>{icon}</i> : null}
        </div>
        <strong className="block mt-4">{value}</strong>
      </div>
      {(detail || trend) && (
        <div className="mt-5 border-t border-slate-50 pt-4">
          {detail ? <p className="text-xs text-slate-500 leading-relaxed">{detail}</p> : null}
          {trend ? <em className="not-italic block mt-2">{trend}</em> : null}
        </div>
      )}
    </div>
  );
}

export function StatGroup({ children }: { children: ReactNode }) {
  return <div className="cs-stat-group gap-5 lg:gap-6">{children}</div>;
}

export function DataTable({
  columns,
  rows,
  empty
}: {
  columns: string[];
  rows: ReactNode[][];
  empty?: ReactNode;
}) {
  if (!rows.length) {
    return (
      <div className="p-8">
        <EmptyState title="No records found" description="There are no records for this workspace yet." action={empty} />
      </div>
    );
  }
  return (
    <div className="cs-table-wrap -mx-5 lg:-mx-6">
      <table className="cs-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="cs-detail-list -mx-5 lg:-mx-6 -mb-5 lg:-mb-6">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value || "None"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="cs-filter-bar gap-4 -mx-5 lg:-mx-6 -mt-5 lg:-mt-6 mb-5 lg:mb-6">{children}</div>;
}

export function SearchInput({ label = "Search", placeholder = "Search" }: { label?: string; placeholder?: string }) {
  return (
    <label className="cs-search-input">
      <span className="sr-only">{label}</span>
      <input placeholder={placeholder} type="search" />
    </label>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="cs-empty p-12 lg:p-16">
      {icon ? <span className="cs-empty-icon mb-6">{icon}</span> : null}
      <strong className="text-xl">{title}</strong>
      <p className="mt-4 mb-8 text-lg">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading workspace data..." }: { label?: string }) {
  return (
    <div className="cs-loading">
      <Loader2 size={16} />
      {label}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="cs-skeleton p-6 lg:p-8" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => <span key={index} />)}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <InlineNotice tone="warning" title="Data unavailable">{message}</InlineNotice>;
}

export function InlineNotice({
  title,
  children,
  tone = "info"
}: {
  title: string;
  children?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="cs-notice p-5 lg:p-6 mb-6" data-tone={tone}>
      <strong>{title}</strong>
      {children ? <p className="mt-2">{children}</p> : null}
    </div>
  );
}

export function Timeline({
  events
}: {
  events: Array<{ title: string; description?: string; time?: string; status?: string }>;
}) {
  if (!events.length) {
    return <EmptyState title="No recent activity" description="Activity will appear after scans, findings, reports, or governed actions are recorded." />;
  }
  return (
    <ol className="cs-timeline p-6 lg:p-8">
      {events.map((event, index) => (
        <li key={`${event.title}-${event.time ?? index}`} className="pb-8 last:pb-0">
          <span />
          <div className="ml-4">
            <div className="flex flex-wrap items-center gap-3">
              <strong>{event.title}</strong>
              {event.status ? <StatusBadge status={event.status} /> : null}
            </div>
            {event.description ? <p className="mt-2 text-slate-600">{event.description}</p> : null}
            {event.time ? <time className="mt-2 block text-xs text-slate-400">{formatDate(event.time)}</time> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Tabs({ tabs }: { tabs: Array<{ label: string; children: ReactNode }> }) {
  return (
    <div className="cs-tabs gap-6 p-6 lg:p-8">
      {tabs.map((tab) => (
        <section key={tab.label} className="rounded-xl overflow-hidden border border-slate-100 shadow-sm">
          <h3 className="px-5 py-4 bg-slate-50 font-bold border-b border-slate-100">{tab.label}</h3>
          <div className="p-5 lg:p-6 bg-white">
            {tab.children}
          </div>
        </section>
      ))}
    </div>
  );
}

export function OperationalPanel({
  title,
  description,
  icon,
  variant = "operational",
  children,
  action
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  variant?: PanelVariant;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="cs-op-panel overflow-hidden" data-variant={variant}>
      <div className="cs-op-panel-head px-6 py-5">
        {icon ? <span>{icon}</span> : null}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold">{title}</h3>
          {description ? <p className="mt-1 truncate text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="cs-op-action ml-6">{action}</div> : null}
      </div>
      <div className="cs-op-panel-body p-6 lg:p-8 bg-white border-t border-slate-50">{children}</div>
    </section>
  );
}

export function ActionMenu({ children }: { children: ReactNode }) {
  return <div className="cs-action-menu p-2">{children}</div>;
}

export function CommandPalette({ children }: { children: ReactNode }) {
  return <div className="cs-command-palette p-4">{children}</div>;
}

export function NotificationMenu({ children }: { children: ReactNode }) {
  return <div className="cs-notification-menu">{children}</div>;
}

export function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function humanize(value: unknown) {
  return String(value ?? "Data unavailable")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
