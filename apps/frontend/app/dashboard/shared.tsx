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
  STALE: { label: "Stale", tone: "warning", icon: <AlertCircle size={13} /> }
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
  const label =
    normalized === "AWS_SYNC"
      ? "AWS_SYNC"
      : normalized === "SAMPLE"
        ? "SAMPLE"
        : normalized === "DB_ONLY_READ_ONLY"
          ? "DB ONLY · READ ONLY"
          : normalized === "DATABASE"
            ? "DB ONLY"
            : humanize(normalized);
  return (
    <span className="cs-source" data-source={normalized === "AWS_SYNC" ? "aws" : normalized === "SAMPLE" ? "sample" : "other"}>
      {label}
    </span>
  );
}

export type DataScope = "real" | "sample" | "combined";

export function DataScopeSelector({
  scope,
  onChange,
  realCount,
  sampleCount
}: {
  scope: DataScope;
  onChange: (scope: DataScope) => void;
  realCount: number;
  sampleCount: number;
}) {
  const options: Array<{ value: DataScope; label: string; count: number }> = [
    { value: "real", label: "Real AWS data", count: realCount },
    { value: "sample", label: "Sample/demo data", count: sampleCount },
    { value: "combined", label: "Combined organization view", count: realCount + sampleCount }
  ];

  return (
    <FilterBar>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Data scope</span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={scope === option.value ? "cs-action-primary" : "cs-button-secondary"}
          aria-pressed={scope === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label} ({option.count})
        </button>
      ))}
      <SourceBadge source="DB_ONLY_READ_ONLY" />
    </FilterBar>
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
      <div className="min-w-0">
        {breadcrumbs.length ? (
          <div className="cs-breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
        ) : null}
        {eyebrow ? <p className="cs-page-eyebrow">{eyebrow}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1>{title}</h1>
          {status}
        </div>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="cs-page-meta">{meta}</div> : null}
      </div>
      {(primaryAction || secondaryAction) ? (
        <div className="cs-page-actions">
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
      <div className={noPadding ? "" : "cs-section-body"}>
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
    <div className="cs-metric" data-tone={tone}>
      <div className="cs-metric-top">
        <span>{label}</span>
        {icon ? <i>{icon}</i> : null}
      </div>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
      {trend ? <em>{trend}</em> : null}
    </div>
  );
}

export function StatGroup({ children }: { children: ReactNode }) {
  return <div className="cs-stat-group">{children}</div>;
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
    return <EmptyState title="No records found" description="There are no records for this workspace yet." action={empty} />;
  }
  return (
    <div className="cs-table-wrap">
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
    <dl className="cs-detail-list">
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
  return <div className="cs-filter-bar">{children}</div>;
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
    <div className="cs-empty">
      {icon ? <span className="cs-empty-icon">{icon}</span> : null}
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
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
    <div className="cs-skeleton" aria-label="Loading">
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
    <div className="cs-notice" data-tone={tone}>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
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
    <ol className="cs-timeline">
      {events.map((event, index) => (
        <li key={`${event.title}-${event.time ?? index}`}>
          <span />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong>{event.title}</strong>
              {event.status ? <StatusBadge status={event.status} /> : null}
            </div>
            {event.description ? <p>{event.description}</p> : null}
            {event.time ? <time>{formatDate(event.time)}</time> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Tabs({ tabs }: { tabs: Array<{ label: string; children: ReactNode }> }) {
  return (
    <div className="cs-tabs">
      {tabs.map((tab) => (
        <section key={tab.label}>
          <h3>{tab.label}</h3>
          {tab.children}
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
    <section className="cs-op-panel" data-variant={variant}>
      <div className="cs-op-panel-head">
        {icon ? <span>{icon}</span> : null}
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="cs-op-action">{action}</div> : null}
      </div>
      <div className="cs-op-panel-body">{children}</div>
    </section>
  );
}

export function ActionMenu({ children }: { children: ReactNode }) {
  return <div className="cs-action-menu">{children}</div>;
}

export function CommandPalette({ children }: { children: ReactNode }) {
  return <div className="cs-command-palette">{children}</div>;
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
