"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  FileText,
  GitBranch,
  KeyRound,
  Layers3,
  Network,
  RadioTower,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet
} from "lucide-react";
import { RefreshBadge, useCloudShieldData } from "../../lib/client-api";
import { AccountDetailWorkspace, AccountsWorkspace } from "./account-workflows";
import {
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  FilterBar,
  formatDate,
  humanize,
  InlineNotice,
  MetricTile,
  PageHeader,
  Section,
  SourceBadge,
  StatGroup,
  StatusBadge,
  Timeline
} from "./shared";

type AnyRecord = Record<string, any>;

const emptyObject: AnyRecord = {};

function pickArray(data: any, keys: string[] = []) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    const value = data?.[key];
    if (Array.isArray(value)) return value;
  }
  for (const value of Object.values(data ?? {})) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function pickNumber(data: any, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = data?.[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return fallback;
}

function text(value: any, fallback = "None") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function sourceFor(item: AnyRecord, parent?: AnyRecord) {
  return item.dataSource ?? item.source ?? parent?.dataSource ?? parent?.source ?? null;
}

function ErrorAndRefresh({ error, isRefreshing }: { error: string | null; isRefreshing: boolean }) {
  return <RefreshBadge error={error} isRefreshing={isRefreshing} />;
}

function ConsoleLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="cs-link" href={href}>
      {children}
    </Link>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="cs-action-primary" href={href}>
      {children}
      <ArrowRight size={15} />
    </Link>
  );
}

export function OverviewView() {
  const summary = useCloudShieldData<AnyRecord>("/api/v1/dashboard/summary", emptyObject);
  const activity = useCloudShieldData<AnyRecord>("/api/v1/platform/activity", emptyObject);
  const readiness = useCloudShieldData<AnyRecord>("/api/v1/platform/readiness", emptyObject);
  const connector = useCloudShieldData<AnyRecord>("/api/v1/aws/connector/status", emptyObject);
  const scans = useCloudShieldData<AnyRecord>("/api/v1/inventory/scans", { scanRuns: [] });
  const approvals = useCloudShieldData<AnyRecord>("/api/v1/governance/approvals", { approvals: [] });
  const events = pickArray(activity.data, ["events", "activity", "items"]).slice(0, 8);
  const modules = pickArray(summary.data, ["modules", "moduleStatus", "cards"]).slice(0, 8);
  const scanRuns = pickArray(scans.data, ["scanRuns", "runs", "items"]).slice(0, 5);
  const approvalRows = pickArray(approvals.data, ["approvals", "items"]);
  const accountCount = pickNumber(summary.data, ["accounts", "accountCount", "awsAccounts"]);
  const resourceCount = pickNumber(summary.data, ["resources", "resourceCount", "inventoryResources"]);
  const openFindings = pickNumber(summary.data, ["openFindings", "findings", "securityFindings"]);
  const pendingApprovals = approvalRows.filter((row: AnyRecord) => String(row.status).toUpperCase().includes("PENDING")).length;
  const lastScan = scanRuns.find((run: AnyRecord) => String(run.status ?? run.state).toUpperCase().includes("SUCCEEDED")) ?? scanRuns[0];
  const connectorStatus = connector.data.status?.status ?? connector.data.status ?? connector.data.connectionStatus ?? readiness.data.connectorStatus;
  const scannerStatus = readiness.data.scannerStatus ?? readiness.data.inventoryScannerStatus ?? (scanRuns.length ? "READY" : "NOT_CONFIGURED");

  return (
    <>
      <PageHeader
        breadcrumbs={["CloudShield", "Overview"]}
        eyebrow="Cloud operations command center"
        title="Security posture control plane"
        description="Live workspace view for account onboarding, connector readiness, inventory freshness, security workflow, governed operations, and evidence reporting."
        primaryAction={<PrimaryLink href="/dashboard/scans">Start inventory workflow</PrimaryLink>}
        secondaryAction={<PrimaryLink href="/dashboard/accounts">Review accounts</PrimaryLink>}
        status={<StatusBadge status={connectorStatus ?? "NOT_CONFIGURED"} />}
        meta={
          <>
            <span>Connector <StatusBadge status={connectorStatus ?? "NOT_CONFIGURED"} /></span>
            <span>Scanner <StatusBadge status={scannerStatus} /></span>
            <span>Last successful scan {formatDate(lastScan?.completedAt ?? lastScan?.finishedAt ?? lastScan?.updatedAt)}</span>
          </>
        }
      />
      <ErrorAndRefresh error={summary.error || activity.error || readiness.error || connector.error || scans.error || approvals.error} isRefreshing={summary.isRefreshing || activity.isRefreshing || readiness.isRefreshing || connector.isRefreshing || scans.isRefreshing || approvals.isRefreshing} />
      <section className="cs-command-hero">
        <div>
          <span><RadioTower size={16} /> Workspace signal</span>
          <h2>{accountCount ? "Cloud coverage is ready for review" : "Awaiting first account registration"}</h2>
          <p>
            {accountCount
              ? "CloudShield is organizing account, resource, finding, scan, and governance records from the current workspace APIs."
              : "Register an AWS account record to unlock connector validation, inventory sync planning, and posture review workflows."}
          </p>
        </div>
        <div className="cs-command-actions">
          <PrimaryLink href="/dashboard/accounts">Account registry</PrimaryLink>
          <PrimaryLink href="/dashboard/security">Finding queue</PrimaryLink>
        </div>
      </section>
      <StatGroup>
        <MetricTile label="AWS accounts" value={accountCount} detail="Registered account records" tone="info" icon={<Cloud size={16} />} />
        <MetricTile label="Resources" value={resourceCount} detail={resourceCount ? "Current inventory records" : "Awaiting first scan"} icon={<Boxes size={16} />} />
        <MetricTile label="Open findings" value={openFindings} detail="Security and risk workflow" tone={openFindings ? "warning" : "neutral"} icon={<ShieldAlert size={16} />} />
        <MetricTile label="Pending approvals" value={pendingApprovals} detail="Governed work queue" tone={pendingApprovals ? "warning" : "neutral"} icon={<ClipboardCheck size={16} />} />
      </StatGroup>
      <div className="cs-command-grid">
        <Section title="Account posture" description="Onboarding and connector readiness for registered cloud accounts." icon={<Cloud size={16} />} variant="operational">
          <DetailList
            items={[
              { label: "Registered accounts", value: accountCount },
              { label: "Connector state", value: <StatusBadge status={connectorStatus ?? "NOT_CONFIGURED"} /> },
              { label: "Scanner readiness", value: <StatusBadge status={scannerStatus} /> },
              { label: "Last successful scan", value: formatDate(lastScan?.completedAt ?? lastScan?.finishedAt ?? lastScan?.updatedAt) }
            ]}
          />
        </Section>
        <Section title="Actionable next steps" description="Recommended actions from the current workspace state." icon={<Layers3 size={16} />} variant="action">
          <div className="cs-next-steps">
            <ConsoleLink href="/dashboard/accounts">{accountCount ? "Review multi-account coverage" : "Register your first AWS account"}</ConsoleLink>
            <ConsoleLink href="/dashboard/scans">{scanRuns.length ? "Inspect recent scan history" : "Prepare the first inventory scan"}</ConsoleLink>
            <ConsoleLink href="/dashboard/security">{openFindings ? "Triage open security findings" : "Open the finding queue"}</ConsoleLink>
            <ConsoleLink href="/dashboard/reports">Review evidence and reports</ConsoleLink>
          </div>
        </Section>
      </div>
      <div className="cs-two-column">
        <Section title="Platform modules" description="Current module health reported by the API." icon={<BarChart3 size={16} />} variant="status">
          <DataTable
            columns={["Module", "Status", "Updated"]}
            rows={modules.map((module: AnyRecord) => [
              <span key="name" className="font-semibold">{text(module.name ?? module.module ?? module.label)}</span>,
              <StatusBadge key="status" status={module.status ?? module.state} />,
              formatDate(module.updatedAt ?? module.lastUpdatedAt)
            ])}
          />
        </Section>
        <Section title="Recent platform activity" description="Latest recorded workspace events." icon={<Activity size={16} />} variant="insight">
          <Timeline
            events={events.map((event: AnyRecord) => ({
              title: text(event.title ?? event.action ?? event.type, "Activity"),
              description: text(event.description ?? event.summary ?? event.message, ""),
              time: event.createdAt ?? event.updatedAt ?? event.timestamp,
              status: event.status ?? event.state
            }))}
          />
        </Section>
      </div>
      <Section title="Recent scans" description="Inventory sync run history and scanner outcomes." icon={<ScanLine size={16} />} variant="evidence">
        <DataTable
          columns={["Run", "Account", "Status", "Started", "Finished"]}
          rows={scanRuns.map((run: AnyRecord) => [
            <ConsoleLink key="run" href={`/dashboard/scans/${run.id ?? run.scanRunId}`}>{text(run.id ?? run.scanRunId, "Scan run")}</ConsoleLink>,
            text(run.awsAccountId ?? run.accountId),
            <StatusBadge key="status" status={run.status ?? run.state} />,
            formatDate(run.startedAt ?? run.createdAt),
            formatDate(run.completedAt ?? run.finishedAt)
          ])}
        />
      </Section>
    </>
  );
}

export function AccountsView() {
  return <AccountsWorkspace />;
}

export function AccountDetailView({ accountId }: { accountId: string }) {
  return <AccountDetailWorkspace accountId={accountId} />;
}

export function InventoryView() {
  const { data, error, isRefreshing } = useCloudShieldData<AnyRecord>("/api/v1/inventory/resources", { resources: [] });
  const resources = pickArray(data, ["resources", "items"]);

  return (
    <>
      <PageHeader
        breadcrumbs={["Cloud", "Inventory"]}
        title="Resource inventory"
        description="Browse AWS resource records captured by CloudShield inventory syncs."
        secondaryAction={<FilterBar><Search size={14} /> Search and filters are applied by the current API view.</FilterBar>}
      />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <StatGroup>
        <MetricTile label="Resources" value={resources.length} tone="info" />
        <MetricTile label="Accounts" value={new Set(resources.map((resource: AnyRecord) => resource.awsAccountId ?? resource.accountId)).size} />
        <MetricTile label="Regions" value={new Set(resources.map((resource: AnyRecord) => resource.region).filter(Boolean)).size} />
      </StatGroup>
      <Section title="Inventory records">
        <DataTable
          columns={["Resource", "Type", "Account", "Region", "Status", "Source"]}
          rows={resources.map((resource: AnyRecord) => [
            <ConsoleLink key="name" href={`/dashboard/inventory/${resource.id ?? resource.resourceId}`}>{text(resource.name ?? resource.resourceId ?? resource.arn, "Resource")}</ConsoleLink>,
            text(resource.type ?? resource.resourceType),
            <span key="account" className="font-mono text-xs">{text(resource.awsAccountId ?? resource.accountId)}</span>,
            text(resource.region),
            <StatusBadge key="status" status={resource.status ?? resource.state} />,
            <SourceBadge key="source" source={sourceFor(resource, data)} />
          ])}
        />
      </Section>
    </>
  );
}

export function ResourceDetailView({ resourceId }: { resourceId: string }) {
  const { data, error, isRefreshing } = useCloudShieldData<AnyRecord>(`/api/v1/platform/resources/${resourceId}/detail`, emptyObject);
  const resource = data.resource ?? data;
  const context = data.context ?? {};
  const relationships = pickArray(data, ["relationships", "edges", "connectedResources"]);

  return (
    <>
      <PageHeader
        breadcrumbs={["Cloud", "Inventory", text(resource.resourceType ?? resource.type, "Resource")]}
        title={text(resource.name ?? resource.resourceId ?? resource.arn ?? resourceId)}
        description="Resource metadata, relationships, and security context returned by the API."
        status={<StatusBadge status={resource.status ?? resource.state} />}
      />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <div className="cs-two-column">
        <Section title="Resource details">
          <DetailList
            items={[
              { label: "Resource ID", value: <span className="font-mono text-xs">{text(resource.resourceId ?? resource.id ?? resourceId)}</span> },
              { label: "ARN", value: <span className="font-mono text-xs">{text(resource.arn)}</span> },
              { label: "Type", value: text(resource.type ?? resource.resourceType) },
              { label: "Account", value: text(resource.awsAccountId ?? resource.accountId) },
              { label: "Region", value: text(resource.region) },
              { label: "Source", value: <SourceBadge source={sourceFor(resource, data)} /> }
            ]}
          />
        </Section>
        <Section title="Context">
          <DetailList
            items={[
              { label: "Risk", value: <StatusBadge status={context.riskLevel ?? context.severity} /> },
              { label: "Owner", value: text(context.owner ?? resource.owner) },
              { label: "Updated", value: formatDate(resource.updatedAt ?? context.updatedAt) }
            ]}
          />
        </Section>
      </div>
      <Section title="Relationships">
        <DataTable
          columns={["Resource", "Relationship", "Status"]}
          rows={relationships.map((item: AnyRecord) => [
            text(item.name ?? item.targetResourceId ?? item.resourceId),
            text(item.relationship ?? item.type),
            <StatusBadge key="status" status={item.status ?? item.state} />
          ])}
        />
      </Section>
    </>
  );
}

export function SecurityView() {
  const { data, error, isRefreshing } = useCloudShieldData<AnyRecord>("/api/v1/findings/security", { findings: [] });
  const findings = pickArray(data, ["findings", "items"]);

  return (
    <>
      <PageHeader breadcrumbs={["Security"]} title="Security findings" description="Prioritized findings and workflow state from CloudShield security analysis." />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <StatGroup>
        <MetricTile label="Open findings" value={findings.filter((finding: AnyRecord) => !["RESOLVED", "ARCHIVED", "CLOSED"].includes(String(finding.status ?? finding.workflowStatus).toUpperCase())).length} tone="warning" />
        <MetricTile label="Critical" value={findings.filter((finding: AnyRecord) => String(finding.severity).toUpperCase() === "CRITICAL").length} tone="danger" />
        <MetricTile label="Resolved" value={findings.filter((finding: AnyRecord) => ["RESOLVED", "CLOSED"].includes(String(finding.status ?? finding.workflowStatus).toUpperCase())).length} tone="success" />
      </StatGroup>
      <Section title="Finding queue">
        <DataTable
          columns={["Finding", "Severity", "Resource", "Workflow", "Source", "Updated"]}
          rows={findings.map((finding: AnyRecord) => [
            text(finding.title ?? finding.name, "Finding"),
            <StatusBadge key="severity" status={finding.severity} />,
            text(finding.resourceId ?? finding.resource?.name ?? finding.awsResourceId),
            <StatusBadge key="status" status={finding.workflowStatus ?? finding.status} />,
            <SourceBadge key="source" source={sourceFor(finding, data)} />,
            formatDate(finding.updatedAt ?? finding.createdAt)
          ])}
        />
      </Section>
    </>
  );
}

export function GovernanceView() {
  const plans = useCloudShieldData<AnyRecord>("/api/v1/remediation/plans", { plans: [] });
  const approvals = useCloudShieldData<AnyRecord>("/api/v1/governance/approvals", { approvals: [] });
  const activity = useCloudShieldData<AnyRecord>("/api/v1/governance/activity", { events: [] });
  const planRows = pickArray(plans.data, ["plans", "items"]);
  const approvalRows = pickArray(approvals.data, ["approvals", "items"]);

  return (
    <>
      <PageHeader breadcrumbs={["Governance"]} title="Governed operations" description="Remediation plans, approvals, owners, and audit events for manual cloud operations." />
      <ErrorAndRefresh error={plans.error || approvals.error || activity.error} isRefreshing={plans.isRefreshing || approvals.isRefreshing || activity.isRefreshing} />
      <InlineNotice title="Approval required" tone="info">Operational work is tracked through plans, approvals, owners, and completion evidence.</InlineNotice>
      <StatGroup>
        <MetricTile label="Plans" value={planRows.length} />
        <MetricTile label="Pending approvals" value={approvalRows.filter((row: AnyRecord) => String(row.status).toUpperCase().includes("PENDING")).length} tone="warning" />
        <MetricTile label="Completed" value={planRows.filter((row: AnyRecord) => String(row.executionStatus ?? row.status).toUpperCase().includes("COMPLETED")).length} tone="success" />
      </StatGroup>
      <div className="cs-two-column">
        <Section title="Remediation plans">
          <DataTable
            columns={["Plan", "Owner", "Status", "Updated"]}
            rows={planRows.map((plan: AnyRecord) => [
              text(plan.title ?? plan.name),
              text(plan.ownerName ?? plan.ownerEmail ?? plan.assignee),
              <StatusBadge key="status" status={plan.executionStatus ?? plan.status} />,
              formatDate(plan.updatedAt ?? plan.createdAt)
            ])}
          />
        </Section>
        <Section title="Governance activity">
          <Timeline
            events={pickArray(activity.data, ["events", "activity", "items"]).slice(0, 8).map((event: AnyRecord) => ({
              title: text(event.action ?? event.title ?? event.type, "Governance event"),
              description: text(event.description ?? event.summary, ""),
              time: event.createdAt ?? event.timestamp,
              status: event.status
            }))}
          />
        </Section>
      </div>
    </>
  );
}

export function AutomationView() {
  const { data, error, isRefreshing } = useCloudShieldData<AnyRecord>("/api/v1/automation/latest", emptyObject);
  const jobs = pickArray(data, ["jobs", "runs", "items", "activity"]);

  return (
    <>
      <PageHeader breadcrumbs={["Operations", "Automation"]} title="Automation center" description="Latest advisory automation runs, job outcomes, and report workflow status." />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <StatGroup>
        <MetricTile label="Latest status" value={<StatusBadge status={data.status ?? data.latestStatus} />} />
        <MetricTile label="Runs" value={jobs.length} />
        <MetricTile label="Updated" value={formatDate(data.updatedAt ?? data.createdAt)} />
      </StatGroup>
      <Section title="Automation runs">
        <DataTable
          columns={["Run", "Status", "Summary", "Updated"]}
          rows={jobs.map((job: AnyRecord) => [
            text(job.name ?? job.id ?? job.type, "Automation run"),
            <StatusBadge key="status" status={job.status ?? job.state} />,
            text(job.summary ?? job.description),
            formatDate(job.updatedAt ?? job.createdAt)
          ])}
        />
      </Section>
    </>
  );
}

export function ComplianceView() {
  const { data, error, isRefreshing } = useCloudShieldData<AnyRecord>("/api/v1/compliance/evidence-center", { controls: [] });
  const controls = pickArray(data, ["controls", "evidence", "items"]);

  return (
    <>
      <PageHeader breadcrumbs={["Security", "Compliance"]} title="Compliance evidence" description="Control status, evidence records, and framework mapping produced by the evidence center." />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <StatGroup>
        <MetricTile label="Controls" value={controls.length} />
        <MetricTile label="Passing" value={controls.filter((control: AnyRecord) => String(control.status).toUpperCase().includes("PASS")).length} tone="success" />
        <MetricTile label="Needs review" value={controls.filter((control: AnyRecord) => String(control.status).toUpperCase().includes("FAIL") || String(control.status).toUpperCase().includes("REVIEW")).length} tone="warning" />
      </StatGroup>
      <Section title="Control evidence">
        <DataTable
          columns={["Control", "Framework", "Status", "Evidence", "Source"]}
          rows={controls.map((control: AnyRecord) => [
            text(control.title ?? control.controlId ?? control.name, "Control"),
            text(control.framework ?? control.standard),
            <StatusBadge key="status" status={control.status ?? control.result} />,
            text(control.evidenceCount ?? control.evidenceItems ?? control.summary),
            <SourceBadge key="source" source={sourceFor(control, data)} />
          ])}
        />
      </Section>
    </>
  );
}

export function CostView() {
  const { data, error, isRefreshing } = useCloudShieldData<AnyRecord>("/api/v1/findings/cost", { findings: [] });
  const findings = pickArray(data, ["findings", "items"]);

  return (
    <>
      <PageHeader breadcrumbs={["Cloud", "Cost"]} title="Cost findings" description="FinOps signals for unused resources, tagging hygiene, and account-level cost governance." />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <StatGroup>
        <MetricTile label="Findings" value={findings.length} tone="warning" />
        <MetricTile label="High impact" value={findings.filter((finding: AnyRecord) => String(finding.impact ?? finding.severity).toUpperCase() === "HIGH").length} />
        <MetricTile label="Estimated savings" value={text(data.estimatedSavings ?? data.summary?.estimatedSavings, "Not reported")} />
      </StatGroup>
      <Section title="FinOps queue">
        <DataTable
          columns={["Finding", "Impact", "Account", "Status", "Source"]}
          rows={findings.map((finding: AnyRecord) => [
            text(finding.title ?? finding.name),
            <StatusBadge key="impact" status={finding.impact ?? finding.severity} />,
            text(finding.awsAccountId ?? finding.accountId),
            <StatusBadge key="status" status={finding.status ?? finding.workflowStatus} />,
            <SourceBadge key="source" source={sourceFor(finding, data)} />
          ])}
        />
      </Section>
    </>
  );
}

export function RecommendationsView() {
  const { data, error, isRefreshing } = useCloudShieldData<AnyRecord>("/api/v1/recommendations", { recommendations: [] });
  const recommendations = pickArray(data, ["recommendations", "items"]);

  return (
    <>
      <PageHeader breadcrumbs={["Security", "Recommendations"]} title="Recommendations" description="Prioritized recommendations built from findings, inventory context, and governance workflow data." />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <Section title="Recommendation backlog">
        <DataTable
          columns={["Recommendation", "Priority", "Domain", "Status", "Source"]}
          rows={recommendations.map((item: AnyRecord) => [
            text(item.title ?? item.name),
            <StatusBadge key="priority" status={item.priority ?? item.severity} />,
            text(item.category ?? item.domain),
            <StatusBadge key="status" status={item.status ?? item.workflowStatus} />,
            <SourceBadge key="source" source={sourceFor(item, data)} />
          ])}
        />
      </Section>
    </>
  );
}

export function GraphView() {
  const { data, error, isRefreshing } = useCloudShieldData<AnyRecord>("/api/v1/resources/graph", { nodes: [], edges: [] });
  const nodes = pickArray(data, ["nodes", "resources"]);
  const edges = pickArray(data, ["edges", "relationships"]);

  return (
    <>
      <PageHeader breadcrumbs={["Cloud", "Graph"]} title="Resource graph" description="Relationship map for cloud resources, findings, accounts, and evidence records." />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <StatGroup>
        <MetricTile label="Nodes" value={nodes.length} tone="info" />
        <MetricTile label="Relationships" value={edges.length} />
        <MetricTile label="Resource types" value={new Set(nodes.map((node: AnyRecord) => node.type ?? node.resourceType).filter(Boolean)).size} />
      </StatGroup>
      <Section title="Graph records">
        <DataTable
          columns={["Node", "Type", "Account", "Status"]}
          rows={nodes.map((node: AnyRecord) => [
            text(node.label ?? node.name ?? node.id),
            text(node.type ?? node.resourceType),
            text(node.awsAccountId ?? node.accountId),
            <StatusBadge key="status" status={node.status ?? node.state} />
          ])}
        />
      </Section>
    </>
  );
}

export function ScansView() {
  const runs = useCloudShieldData<AnyRecord>("/api/v1/inventory/scans", { scanRuns: [] });
  const plan = useCloudShieldData<AnyRecord>("/api/v1/aws/inventory/plan", emptyObject);
  const scanRuns = pickArray(runs.data, ["scanRuns", "runs", "items"]);

  return (
    <>
      <PageHeader breadcrumbs={["Operations", "Scans"]} title="Inventory scans" description="Readiness, run history, and resource ingestion workflow for AWS inventory sync." />
      <ErrorAndRefresh error={runs.error || plan.error} isRefreshing={runs.isRefreshing || plan.isRefreshing} />
      <StatGroup>
        <MetricTile label="Runs" value={scanRuns.length} />
        <MetricTile label="Succeeded" value={scanRuns.filter((run: AnyRecord) => String(run.status).toUpperCase().includes("SUCCEEDED")).length} tone="success" />
        <MetricTile label="Plan status" value={<StatusBadge status={plan.data.status ?? plan.data.readinessStatus} />} />
      </StatGroup>
      <Section title="Scan runs">
        <DataTable
          columns={["Run", "Account", "Status", "Started", "Finished"]}
          rows={scanRuns.map((run: AnyRecord) => [
            <ConsoleLink key="run" href={`/dashboard/scans/${run.id ?? run.scanRunId}`}>{text(run.id ?? run.scanRunId, "Scan run")}</ConsoleLink>,
            text(run.awsAccountId ?? run.accountId),
            <StatusBadge key="status" status={run.status ?? run.state} />,
            formatDate(run.startedAt ?? run.createdAt),
            formatDate(run.completedAt ?? run.finishedAt)
          ])}
        />
      </Section>
    </>
  );
}

export function ScanDetailView({ scanRunId }: { scanRunId: string }) {
  const { data, error, isRefreshing } = useCloudShieldData<AnyRecord>(`/api/v1/inventory/scans/${scanRunId}`, emptyObject);
  const run = data.scanRun ?? data.run ?? data;
  const items = pickArray(data, ["resources", "items", "events"]);

  return (
    <>
      <PageHeader
        breadcrumbs={["Operations", "Scans", scanRunId]}
        title="Scan run detail"
        description="Run metadata, ingestion results, and event timeline for a single inventory sync."
        status={<StatusBadge status={run.status ?? run.state} />}
      />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <div className="cs-two-column">
        <Section title="Run metadata">
          <DetailList
            items={[
              { label: "Run ID", value: <span className="font-mono text-xs">{scanRunId}</span> },
              { label: "Account", value: text(run.awsAccountId ?? run.accountId) },
              { label: "Started", value: formatDate(run.startedAt ?? run.createdAt) },
              { label: "Finished", value: formatDate(run.completedAt ?? run.finishedAt) }
            ]}
          />
        </Section>
        <Section title="Run counts">
          <StatGroup>
            <MetricTile label="Resources" value={pickNumber(run, ["resourceCount", "resourcesScanned"], items.length)} />
            <MetricTile label="Errors" value={pickNumber(run, ["errorCount", "errors"])} tone="warning" />
          </StatGroup>
        </Section>
      </div>
      <Section title="Run records">
        <DataTable
          columns={["Record", "Type", "Status", "Updated"]}
          rows={items.map((item: AnyRecord) => [
            text(item.name ?? item.resourceId ?? item.title ?? item.id),
            text(item.type ?? item.resourceType ?? item.eventType),
            <StatusBadge key="status" status={item.status ?? item.state} />,
            formatDate(item.updatedAt ?? item.createdAt ?? item.timestamp)
          ])}
        />
      </Section>
    </>
  );
}

export function ReportsView() {
  const reports = useCloudShieldData<AnyRecord>("/api/v1/reports", { reports: [] });
  const summary = useCloudShieldData<AnyRecord>("/api/v1/reports/summary", emptyObject);
  const rows = pickArray(reports.data, ["reports", "items"]);

  return (
    <>
      <PageHeader breadcrumbs={["Operations", "Reports"]} title="Reports" description="Generated reports, summaries, and evidence packages for cloud governance stakeholders." />
      <ErrorAndRefresh error={reports.error || summary.error} isRefreshing={reports.isRefreshing || summary.isRefreshing} />
      <StatGroup>
        <MetricTile label="Reports" value={rows.length} />
        <MetricTile label="Completed" value={rows.filter((row: AnyRecord) => String(row.status).toUpperCase().includes("COMPLETED")).length} tone="success" />
        <MetricTile label="Latest" value={formatDate(summary.data.latestReportAt ?? rows[0]?.createdAt)} />
      </StatGroup>
      <Section title="Report library">
        <DataTable
          columns={["Report", "Type", "Status", "Created", "Source"]}
          rows={rows.map((report: AnyRecord) => [
            text(report.title ?? report.name ?? report.id, "Report"),
            text(report.type ?? report.reportType),
            <StatusBadge key="status" status={report.status ?? report.state} />,
            formatDate(report.createdAt ?? report.updatedAt),
            <SourceBadge key="source" source={sourceFor(report, reports.data)} />
          ])}
        />
      </Section>
    </>
  );
}

export function SettingsView() {
  const platform = useCloudShieldData<AnyRecord>("/api/v1/platform/settings", emptyObject);
  const connector = useCloudShieldData<AnyRecord>("/api/v1/aws/connector/status", emptyObject);
  const settings = platform.data.settings ?? platform.data;
  const status = connector.data.status ?? connector.data;

  return (
    <>
      <PageHeader breadcrumbs={["Administration", "Settings"]} eyebrow="Enterprise administration" title="Settings" description="Workspace administration, access, integration, notifications, evidence, and audit controls." />
      <ErrorAndRefresh error={platform.error || connector.error} isRefreshing={platform.isRefreshing || connector.isRefreshing} />
      <div className="cs-settings-grid">
        <Section title="Workspace" icon={<KeyRound size={16} />} variant="detail">
          <DetailList
            items={[
              { label: "Organization", value: text(settings.organizationName ?? settings.name) },
              { label: "Environment", value: text(settings.environmentMode ?? settings.environment) },
              { label: "Region", value: text(settings.region ?? settings.defaultRegion) },
              { label: "Updated", value: formatDate(settings.updatedAt) }
            ]}
          />
        </Section>
        <Section title="AWS integration" icon={<Cloud size={16} />} variant="operational">
          <DetailList
            items={[
              { label: "Status", value: <StatusBadge status={status.status ?? status.connectionStatus} /> },
              { label: "Validation", value: <StatusBadge status={status.validationStatus ?? status.readinessStatus} /> },
              { label: "Last checked", value: formatDate(status.lastValidatedAt ?? status.updatedAt) },
              { label: "Source", value: <SourceBadge source={sourceFor(status, connector.data)} /> }
            ]}
          />
        </Section>
      </div>
      <Section title="Members and access" description="Manage users, roles, teams, and invitations." icon={<Users size={16} />} variant="action">
        <div className="cs-action-grid">
          <PrimaryLink href="/dashboard/settings/members">Manage members</PrimaryLink>
          <PrimaryLink href="/dashboard/accounts">Review account access</PrimaryLink>
        </div>
      </Section>
      <div className="cs-settings-grid">
        <Section title="Security controls" description="Security controls are enforced by the existing backend policies." icon={<ShieldCheck size={16} />} variant="status">
          <DetailList items={[
            { label: "Session protection", value: "CSRF and exact-origin validation" },
            { label: "Access model", value: "Role and membership scoped" },
            { label: "Tenant isolation", value: "Organization-scoped records" }
          ]} />
        </Section>
        <Section title="Notifications" description="Operational notification preferences and delivery status." icon={<Activity size={16} />} variant="insight">
          <DetailList items={[
            { label: "Status", value: text(settings.notificationStatus ?? "Not configured") },
            { label: "Default channel", value: text(settings.notificationChannel) },
            { label: "Updated", value: formatDate(settings.notificationsUpdatedAt ?? settings.updatedAt) }
          ]} />
        </Section>
        <Section title="Audit and evidence" description="Evidence and activity records available from reporting workflows." icon={<FileText size={16} />} variant="evidence">
          <DetailList items={[
            { label: "Evidence center", value: <ConsoleLink href="/dashboard/compliance">Open evidence center</ConsoleLink> },
            { label: "Reports", value: <ConsoleLink href="/dashboard/reports">Open report library</ConsoleLink> },
            { label: "Governance activity", value: <ConsoleLink href="/dashboard/governance">Open audit timeline</ConsoleLink> }
          ]} />
        </Section>
        <Section title="Danger zone" description="No destructive workspace actions are exposed by this frontend." icon={<ShieldAlert size={16} />} variant="warning">
          <div className="cs-danger-zone">
            <strong>No supported destructive action</strong>
            <p>Workspace deletion or irreversible administrative actions are not available in the current API surface.</p>
          </div>
        </Section>
      </div>
      <Section title="Administration shortcuts" icon={<Layers3 size={16} />} variant="action">
        <div className="cs-action-grid">
          <PrimaryLink href="/dashboard/accounts">Account registry</PrimaryLink>
          <PrimaryLink href="/dashboard/reports">Open reports</PrimaryLink>
        </div>
      </Section>
    </>
  );
}

export function MembersView() {
  const members = useCloudShieldData<AnyRecord>("/api/v1/members", { members: [] });
  const teams = useCloudShieldData<AnyRecord>("/api/v1/teams", { teams: [] });
  const rows = pickArray(members.data, ["members", "items", "users"]);

  return (
    <>
      <PageHeader breadcrumbs={["Administration", "Members"]} title="Members" description="Workspace members, roles, teams, and access status." />
      <ErrorAndRefresh error={members.error || teams.error} isRefreshing={members.isRefreshing || teams.isRefreshing} />
      <StatGroup>
        <MetricTile label="Members" value={rows.length} />
        <MetricTile label="Teams" value={pickArray(teams.data, ["teams", "items"]).length} />
        <MetricTile label="Owners" value={rows.filter((row: AnyRecord) => String(row.role).toUpperCase().includes("OWNER") || String(row.role).toUpperCase().includes("ADMIN")).length} />
      </StatGroup>
      <Section title="Member directory">
        <DataTable
          columns={["Member", "Email", "Role", "Status", "Last active"]}
          rows={rows.map((member: AnyRecord) => [
            text(member.name ?? member.user?.name, "Member"),
            text(member.email ?? member.user?.email),
            humanize(member.role ?? member.user?.role),
            <StatusBadge key="status" status={member.status ?? member.invitationStatus ?? "ACTIVE"} />,
            formatDate(member.lastActiveAt ?? member.updatedAt)
          ])}
        />
      </Section>
    </>
  );
}

export function RouteIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    overview: <Activity size={16} />,
    accounts: <Cloud size={16} />,
    inventory: <Boxes size={16} />,
    security: <ShieldAlert size={16} />,
    governance: <ClipboardCheck size={16} />,
    automation: <RefreshCw size={16} />,
    compliance: <ShieldCheck size={16} />,
    cost: <Wallet size={16} />,
    recommendations: <Sparkles size={16} />,
    graph: <Network size={16} />,
    scans: <ScanLine size={16} />,
    reports: <FileText size={16} />,
    settings: <KeyRound size={16} />,
    members: <Users size={16} />,
    metrics: <BarChart3 size={16} />,
    branch: <GitBranch size={16} />
  };
  return icons[name] ?? <CheckCircle2 size={16} />;
}
