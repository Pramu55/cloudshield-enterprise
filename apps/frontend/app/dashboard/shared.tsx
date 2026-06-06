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
  if (!status) return { label: "Unknown", tone: "disabled" as Tone, icon: <Circle size={13} /> };
  return statusMap[String(status).toUpperCase()] ?? {
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
  primaryAction,
  secondaryAction,
  status
}: {
  breadcrumbs?: string[];
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  status?: ReactNode;
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
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1>{title}</h1>
          {status}
        </div>
        {description ? <p>{description}</p> : null}
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
  action,
  children
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="cs-section">
      <div className="cs-section-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="cs-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
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
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="cs-empty">
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
  return String(value ?? "Unknown")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
