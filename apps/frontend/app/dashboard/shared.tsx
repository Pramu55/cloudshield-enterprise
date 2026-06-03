import type { ReactNode } from "react";

type DashboardPageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function DashboardPage({
  title,
  description,
  children
}: DashboardPageProps) {
  return (
    <div className="portal-page">
      <div className="mb-5 border-b border-line pb-4">
        <h2 className="portal-page-title">{title}</h2>
        <p className="portal-page-description mt-1">
          {description}
        </p>
      </div>
      {children || <FoundationPanel />}
    </div>
  );
}

export function FoundationPanel() {
  return (
    <section className="portal-blade rounded-md border border-line bg-white p-6">
      <p className="text-sm font-semibold text-ink">Enterprise governance workspace</p>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        This page is prepared for CloudShield enterprise cloud governance workflows.
        Current modules use typed contracts, tenant-scoped APIs, sample/demo data,
        and safe read-only positioning before AWS inventory scanners are introduced.
      </p>
    </section>
  );
}

type WorkspaceHeroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: ReactNode;
  badges?: Array<{ label: string; tone?: "neutral" | "good" | "warning" | "danger" | "info" }>;
  actions?: ReactNode;
  children?: ReactNode;
};

export function WorkspaceHero({
  eyebrow,
  title,
  description,
  icon,
  badges = [],
  actions,
  children
}: WorkspaceHeroProps) {
  return (
    <section className="workspace-hero mb-6">
      <div className="workspace-hero-grid">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {icon ? <span className="workspace-hero-icon">{icon}</span> : null}
            {eyebrow ? <span className="workspace-eyebrow">{eyebrow}</span> : null}
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-bold leading-tight text-white">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {description}
          </p>
          {badges.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <StatusBadge key={badge.label} tone={badge.tone || "neutral"}>
                  {badge.label}
                </StatusBadge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="workspace-hero-side">
          {children}
          {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function StatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "danger" | "info";
}) {
  const toneClass = {
    neutral: "border-slate-600 bg-slate-800/80 text-slate-200",
    good: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-400/50 bg-amber-500/10 text-amber-100",
    danger: "border-red-400/50 bg-red-500/10 text-red-100",
    info: "border-indigo-300/50 bg-indigo-500/15 text-indigo-100"
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${toneClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function ProgressRing({
  value,
  label,
  caption
}: {
  value: number;
  label: string;
  caption?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-4">
      <div
        className="progress-ring"
        style={{ "--progress": `${clamped * 3.6}deg` } as React.CSSProperties}
      >
        <div className="progress-ring-core">
          <span>{clamped}</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        {caption ? <p className="mt-1 text-xs leading-5 text-slate-300">{caption}</p> : null}
      </div>
    </div>
  );
}

export function ProgressBars({
  items
}: {
  items: Array<{ label: string; value: number; tone?: "good" | "warning" | "danger" | "info" }>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>{item.label}</span>
            <span>{item.value}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${barTone(item.tone)}`}
              style={{ width: `${Math.max(0, Math.min(100, item.value))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function barTone(tone?: "good" | "warning" | "danger" | "info") {
  if (tone === "good") return "bg-emerald-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "danger") return "bg-red-500";
  return "bg-indigo-600";
}

export function ReadinessJourney({
  steps
}: {
  steps: Array<{ label: string; description: string; status: "done" | "active" | "blocked" | "planned" }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {steps.map((step, index) => (
        <div className="journey-step" data-status={step.status} key={step.label}>
          <div className="flex items-center justify-between">
            <span className="journey-index">{index + 1}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {step.status}
            </span>
          </div>
          <p className="mt-3 text-sm font-bold text-ink">{step.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
        </div>
      ))}
    </div>
  );
}

export function CommandCard({
  icon,
  title,
  description,
  href,
  action
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  href?: string;
  action?: ReactNode;
}) {
  const content = (
    <>
      <div className="flex items-start gap-3">
        {icon ? <span className="workspace-icon-soft">{icon}</span> : null}
        <div>
          <p className="text-sm font-bold text-ink">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </>
  );

  if (href) {
    return (
      <a className="command-card" href={href}>
        {content}
      </a>
    );
  }

  return <div className="command-card">{content}</div>;
}

export function InsightPanel({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="insight-panel">
      <div className="border-b border-line px-5 py-4">
        <p className="text-sm font-bold text-ink">{title}</p>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function ActivityTimeline({
  events
}: {
  events: Array<{ title: string; description?: string; time?: string; tone?: "good" | "warning" | "danger" | "info" }>;
}) {
  return (
    <div className="activity-timeline">
      {events.map((event) => (
        <div className="activity-event" data-tone={event.tone || "info"} key={`${event.title}-${event.time || ""}`}>
          <span className="activity-dot" />
          <div className="activity-card">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-bold text-ink">{event.title}</p>
              {event.time ? <span className="text-[10px] font-mono text-slate-400">{event.time}</span> : null}
            </div>
            {event.description ? <p className="mt-1 text-xs leading-5 text-slate-500">{event.description}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailBlade({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <aside className="detail-blade">
      <p className="text-sm font-bold text-ink">{title}</p>
      {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </aside>
  );
}

export function StatusMatrix({
  items
}: {
  items: Array<{ label: string; value: string | number | boolean; tone?: "good" | "warning" | "danger" | "info" }>;
}) {
  return (
    <div className="status-matrix">
      {items.map((item) => (
        <div className="status-matrix-cell" data-tone={item.tone || "info"} key={item.label}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
          <p className="mt-1 text-sm font-bold text-ink">{String(item.value)}</p>
        </div>
      ))}
    </div>
  );
}

export function PremiumDataTable({
  columns,
  rows
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="premium-data-table overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvidenceCard({
  title,
  meta,
  status,
  children
}: {
  title: string;
  meta?: string;
  status?: string;
  children?: ReactNode;
}) {
  return (
    <article className="evidence-card">
      <div className="flex flex-wrap items-center gap-2">
        {status ? <span className="status-pill border-indigo-200 bg-indigo-50 text-indigo-700">{status}</span> : null}
        {meta ? <span className="text-[11px] font-semibold text-slate-400">{meta}</span> : null}
      </div>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      {children ? <div className="mt-2 text-xs leading-5 text-slate-500">{children}</div> : null}
    </article>
  );
}

export function GovernanceStep({
  title,
  description,
  state
}: {
  title: string;
  description: string;
  state: "complete" | "active" | "blocked" | "pending";
}) {
  return (
    <div className="governance-step" data-state={state}>
      <span className="governance-step-dot" />
      <div>
        <p className="text-xs font-bold text-ink">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function EmptyWorkspaceState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-workspace-state">
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
