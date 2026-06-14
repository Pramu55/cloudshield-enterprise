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
import type { ApiError } from "../../lib/api-error";
import {
  FrontendAutomationLatestSchema,
  FrontendCapabilitySessionSchema,
  FrontendCommandCenterResponseSchema,
  FrontendGovernanceApprovalsSchema,
  FrontendGovernanceActivitySchema,
  FrontendComplianceEvidenceCenterSchema,
  FrontendMonitoringHealthSchema,
  FrontendRemediationPlanListSchema,
  type FrontendAutomationLatest,
  type FrontendCapabilitySession,
  type FrontendGovernanceApprovals,
  type FrontendGovernanceActivity,
  type FrontendComplianceEvidenceCenter,
  type FrontendRemediationPlanList,
  type FrontendMonitoringHealth
} from "../../lib/response-contracts";
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
import {
  permissionCapability,
  resolveApprovalCapability,
  resolvePlanExecutionCapability,
  unknownBlockReasonCapability,
  type AuthoritativePermission
} from "../../lib/action-capability";
import {
  CapabilityNotice,
  GuardedAction,
  PermissionRestriction,
} from "../../components/ui/guarded-action";

type AnyRecord = Record<string, any>;

const emptyObject: AnyRecord = {};

function reportedPermission(session: FrontendCapabilitySession | null, permission: string): AuthoritativePermission {
  const value = session?.capabilities?.[permission];
  return value === true ? "ALLOWED" : value === false ? "DENIED" : "UNKNOWN";
}

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

type SourceDescriptor = {
  dataSource?: string | null;
  source?: string | null;
  sampleData?: boolean;
};

function sourceFor(item: SourceDescriptor, parent?: SourceDescriptor | null) {
  return item.dataSource ?? item.source ?? parent?.dataSource ?? parent?.source ?? null;
}

function ErrorAndRefresh({ error, isRefreshing, onRetry }: { error: ApiError | null; isRefreshing: boolean; onRetry?: () => void }) {
  return <RefreshBadge error={error} isRefreshing={isRefreshing} onRetry={onRetry} />;
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

import {
  CommandCenterResponse,
  PostureScoreComponent,
  CloudResourceDto,
  CloudResourceListResponse,
  SecurityFindingDto,
  SecurityFindingsResponse,
  ComplianceControlDto,
  ComplianceEvidenceCenterResponse
} from "@cloudshield/contracts";

function getScoreColor(score: number) {
  if (score >= 90) return "var(--success-color, #10b981)";
  if (score >= 70) return "var(--warning-color, #f59e0b)";
  return "var(--danger-color, #ef4444)";
}

function PostureBar({ component }: { component: PostureScoreComponent }) {
  const clampedScore = Math.max(0, Math.min(100, component.score));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 font-medium text-slate-700">{component.label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-slate-900">{clampedScore}/100</span>
      </div>

      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clampedScore}%`, backgroundColor: getScoreColor(clampedScore) }}
          role="progressbar"
          aria-valuenow={clampedScore}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <p className="text-sm leading-relaxed text-slate-500">
        {component.explanation}
      </p>
    </div>
  );
}

export function OverviewView() {
  const { data, error, isRefreshing, refetch } = useCloudShieldData<CommandCenterResponse | null>("/api/v1/dashboard/command-center", null, { schema: FrontendCommandCenterResponseSchema });
  const { data: monitoringHealth } = useCloudShieldData<FrontendMonitoringHealth | null>("/api/v1/security-monitoring/health", null, { schema: FrontendMonitoringHealthSchema });

  if (error) {
    return <ErrorAndRefresh error={error} isRefreshing={false} onRetry={refetch} />;
  }

  if (!data) {
    return <ErrorAndRefresh error={null} isRefreshing={true} />;
  }

  const {
    executiveSummary,
    postureScore,
    accountHealth,
    inventoryFreshness,
    riskDistribution,
    scanSummary,
    priorityActions,
    recentActivity,
    governanceSummary,
    evidenceReadiness,
    dataFreshness,
    graphSummary
  } = data;

  const connectorStatus = accountHealth.length > 0 && accountHealth.some(a => a.connectionStatus === "VALIDATION_SUCCEEDED")
    ? "CONNECTED" : "NOT_CONFIGURED";

  return (
    <>
      <PageHeader
        breadcrumbs={["CloudShield", "Enterprise Command Center"]}
        eyebrow="Enterprise operations command center"
        title="Security & Governance Posture"
        description="Database-backed executive view for account readiness, security risk, and real-time operational intelligence."
        primaryAction={<PrimaryLink href="/dashboard/scans">Inventory Scans</PrimaryLink>}
        secondaryAction={<PrimaryLink href="/dashboard/accounts">Review Accounts</PrimaryLink>}
        status={<StatusBadge status={connectorStatus} />}
        meta={
          <>
            <span>Connector <StatusBadge status={connectorStatus} /></span>
            <span>Monitoring <StatusBadge status={monitoringHealth?.status || "UNKNOWN"} /></span>
            <span>Data Source <span className="font-mono text-xs ml-1 bg-slate-100 px-1 rounded border border-slate-200">{executiveSummary.dataSource}</span></span>
            <span>Last Sync {inventoryFreshness.lastSyncAt ? formatDate(inventoryFreshness.lastSyncAt) : "Never"}</span>
          </>
        }
      />
      <ErrorAndRefresh error={null} isRefreshing={isRefreshing} />

      <StatGroup>
        <MetricTile label="AWS Accounts" value={executiveSummary.totalAccounts} detail={`${executiveSummary.connectedAccounts} connected`} tone="info" icon={<Cloud size={16} />} />
        <MetricTile label="Cloud Resources" value={executiveSummary.totalResources} detail="Active inventory" icon={<Boxes size={16} />} />
        <MetricTile label="Critical Findings" value={executiveSummary.criticalFindings} detail={`${executiveSummary.activeFindings} total open`} tone={executiveSummary.criticalFindings > 0 ? "danger" : "success"} icon={<ShieldAlert size={16} />} />
        <MetricTile label="Compliance Controls" value={executiveSummary.unresolvedControls} detail="Needs review / Fail" tone={executiveSummary.unresolvedControls > 0 ? "warning" : "neutral"} icon={<ShieldCheck size={16} />} />
      </StatGroup>

      <div className="cs-two-column mt-8 gap-8">
        <Section title="Enterprise Posture Score" description="Deterministic weighted scoring based on real data." icon={<BarChart3 size={16} />} variant="insight">
          <div className="mb-8 flex items-center gap-6 border-b border-slate-100 pb-6">
            {postureScore.assessmentState === "SETUP_INCOMPLETE" || postureScore.assessmentState === "INSUFFICIENT_DATA" || postureScore.assessmentState === "NOT_CALCULATED" ? (
              <>
                <div className="text-4xl font-black text-slate-300">
                  N/A
                </div>
                <div>
                  <div className="text-base font-bold text-slate-800">Score Not Available</div>
                  <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{postureScore.assessmentState.replace("_", " ")}</div>
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl font-black" style={{ color: getScoreColor(postureScore.totalScore) }}>
                  {postureScore.totalScore}
                </div>
                <div>
                  <div className="text-base font-bold text-slate-800">Overall Grade</div>
                  <div className="text-xs text-slate-400 mt-1">Out of 100</div>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {postureScore.components.map(c => <PostureBar key={c.key} component={c} />)}
          </div>
        </Section>

        <Section title="Priority Actions" description="High-impact actions requiring immediate attention." icon={<Activity size={16} />} variant="warning">
          {priorityActions.length === 0 ? (
            <EmptyState title="No priority actions" description="All critical items have been addressed." icon={<CheckCircle2 size={32} />} />
          ) : (
            <div className="flex flex-col gap-4">
              {priorityActions.map(action => (
                <div key={action.id} className="border border-slate-200 rounded-xl p-5 flex flex-col gap-3 bg-white shadow-sm hover:border-orange-200 transition-colors">
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-3">
                      <StatusBadge status={action.severity} />
                      {action.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase bg-slate-50 px-2 py-1 rounded">Score: {action.rankingScore}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{action.reason}</p>
                  <div className="flex items-center justify-between mt-3 pt-4 border-t border-slate-50">
                    <span className="text-xs text-slate-400">Account: <span className="font-mono text-slate-600">{action.accountId || 'N/A'}</span></span>
                    <PrimaryLink href={action.destinationPath}>{action.suggestedAction}</PrimaryLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="cs-two-column mt-8 gap-8">
        <Section title="Risk Distribution" description="Open security findings grouped by severity." icon={<ShieldAlert size={16} />} variant="insight">
          <DetailList items={[
            { label: "Critical", value: <span className="text-red-600 font-bold">{riskDistribution.bySeverity.CRITICAL}</span> },
            { label: "High", value: <span className="text-orange-500 font-bold">{riskDistribution.bySeverity.HIGH}</span> },
            { label: "Medium", value: riskDistribution.bySeverity.MEDIUM },
            { label: "Low", value: riskDistribution.bySeverity.LOW },
            { label: "Info", value: riskDistribution.bySeverity.INFO }
          ]} />
          <div className="mt-4 border-t border-slate-100 pt-4">
             <ConsoleLink href="/dashboard/security">View all findings</ConsoleLink>
          </div>
        </Section>

        <Section title="Scan Summary" description="Inventory scan jobs." icon={<ScanLine size={16} />} variant="operational">
          <DetailList items={[
            { label: "Completed (24h)", value: scanSummary.last24HoursCount },
            { label: "Currently Running", value: scanSummary.running },
            { label: "Queued", value: scanSummary.queued },
            { label: "Failed", value: scanSummary.failed },
            { label: "Blocked", value: scanSummary.blocked },
            { label: "Avg Duration (ms)", value: scanSummary.averageDurationMs ?? "N/A" }
          ]} />
          <div className="mt-4 border-t border-slate-100 pt-4">
             <ConsoleLink href="/dashboard/scans">View all scans</ConsoleLink>
          </div>
        </Section>
      </div>

      <div className="cs-two-column mt-8 gap-8">
        <Section title="Evidence Readiness" description="Governance and evidence metrics." icon={<ClipboardCheck size={16} />} variant="evidence">
          <DetailList items={[
            { label: "Coverage", value: `${Math.round(evidenceReadiness.coveragePercent * 100)}%` },
            { label: "Status", value: <StatusBadge status={evidenceReadiness.status} /> },
            { label: "Controls w/ Evidence", value: evidenceReadiness.controlsWithEvidence },
            { label: "Total Controls", value: evidenceReadiness.totalControls },
            { label: "Owned High Risk", value: evidenceReadiness.ownedHighRiskRecords },
            { label: "Pending Approvals", value: evidenceReadiness.pendingApprovals }
          ]} />
          <div className="mt-4 border-t border-slate-100 pt-4">
             <ConsoleLink href="/dashboard/compliance">View evidence</ConsoleLink>
          </div>
        </Section>

        <Section title="Graph Summary" description="Resource relationship density." icon={<Network size={16} />} variant="insight">
          <DetailList items={[
            { label: "Total Nodes", value: graphSummary.nodeCount },
            { label: "Relationships", value: graphSummary.edgeCount },
            { label: "Accounts", value: graphSummary.accountCount }
          ]} />
          <div className="mt-4 border-t border-slate-100 pt-4">
             <ConsoleLink href="/dashboard/graph">View resource graph</ConsoleLink>
          </div>
        </Section>
      </div>

      <div className="cs-two-column mt-8 gap-8">
        <Section title="Account Health & Readiness" description="Validation status and risk levels across registered AWS environments." icon={<Cloud size={16} />} variant="operational">
          <DataTable
            columns={["Account", "Env", "Connection", "Freshness", "Findings", "Resources"]}
            rows={accountHealth.map(acc => [
              <ConsoleLink key="acc" href={`/dashboard/accounts/${acc.id}`}>{acc.displayName}</ConsoleLink>,
              <span key="env" className="uppercase text-xs font-semibold">{acc.environment}</span>,
              <StatusBadge key="conn" status={acc.connectionStatus} />,
              <StatusBadge key="fresh" status={acc.freshnessStatus} />,
              <span key="find" className="font-mono text-sm">{acc.findingCount}</span>,
              <span key="res" className="font-mono text-sm">{acc.resourceCount}</span>
            ])}
          />
        </Section>

        <Section title="Recent Activity" description="Latest audit events." icon={<Activity size={16} />} variant="detail">
          <Timeline events={recentActivity.map(event => ({
            title: event.title,
            description: event.description,
            time: event.timestamp,
            status: event.status
          }))} />
        </Section>
      </div>
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
  const { data, error, isRefreshing } = useCloudShieldData<CloudResourceListResponse>("/api/v1/inventory/resources", {
    items: [],
    sampleData: false,
    sampleDataLabel: ""
  });
  const resources = data?.items || [];

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
        <MetricTile label="Accounts" value={new Set(resources.map((resource: CloudResourceDto) => resource.awsAccountId)).size} />
        <MetricTile label="Regions" value={new Set(resources.map((resource: CloudResourceDto) => resource.region).filter(Boolean)).size} />
      </StatGroup>
      <Section title="Inventory records">
        <DataTable
          columns={["Resource", "Type", "Account", "Region", "Status", "Source"]}
          rows={resources.map((resource: CloudResourceDto) => [
            <ConsoleLink key="name" href={`/dashboard/inventory/${resource.id}`}>{text(resource.name ?? resource.resourceId, "Resource")}</ConsoleLink>,
            text(resource.resourceType),
            <span key="account" className="font-mono text-xs">{text(resource.awsAccountId)}</span>,
            text(resource.region),
            <StatusBadge key="status" status={resource.status} />,
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
  const { data, error, isRefreshing } = useCloudShieldData<SecurityFindingsResponse>("/api/v1/findings/security", {
    items: [],
    sampleData: false,
    sampleDataLabel: "",
    awsApiCallExecuted: false,
    mutationExecuted: false
  });
  const findings = data?.items || [];

  return (
    <>
      <PageHeader breadcrumbs={["Security"]} title="Security findings" description="Prioritized findings and workflow state from CloudShield security analysis." />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <StatGroup>
        <MetricTile label="Open findings" value={findings.filter((finding: SecurityFindingDto) => !["RESOLVED", "ARCHIVED", "CLOSED"].includes(String(finding.status).toUpperCase())).length} tone="warning" />
        <MetricTile label="Critical" value={findings.filter((finding: SecurityFindingDto) => String(finding.severity).toUpperCase() === "CRITICAL").length} tone="danger" />
        <MetricTile label="Resolved" value={findings.filter((finding: SecurityFindingDto) => ["RESOLVED", "CLOSED"].includes(String(finding.status).toUpperCase())).length} tone="success" />
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

function GovernancePlanAction({ capability, guidance }: { capability: ReturnType<typeof resolvePlanExecutionCapability>; guidance: string }) {
  const showGuidance = capability.blockedReason === "OUTCOME_UNKNOWN" || capability.blockedReason === "MANUAL_REVIEW_REQUIRED" || capability.blockedReason === "RECONCILIATION_PENDING";
  return (
    <div className="flex flex-col gap-2">
      <GuardedAction capability={capability}>Queue execution</GuardedAction>
      {showGuidance ? <CapabilityNotice capability={capability} title="Operator action required" /> : null}
      {showGuidance ? <p className="text-xs text-slate-600">{guidance}</p> : null}
    </div>
  );
}

export function GovernanceView() {
  const plans = useCloudShieldData<FrontendRemediationPlanList | null>("/api/v1/remediation/plans", null, { schema: FrontendRemediationPlanListSchema });
  const approvals = useCloudShieldData<FrontendGovernanceApprovals | null>("/api/v1/governance/approvals", null, { schema: FrontendGovernanceApprovalsSchema });
  const activity = useCloudShieldData<FrontendGovernanceActivity | null>("/api/v1/governance/activity", null, { schema: FrontendGovernanceActivitySchema });
  const session = useCloudShieldData<FrontendCapabilitySession | null>("/api/v1/auth/me", null, { schema: FrontendCapabilitySessionSchema });
  const planRows = plans.data?.items ?? [];
  const approvalRows = approvals.data?.items ?? [];
  const preparePermission = reportedPermission(session.data, "operations.prepare");
  const approvalPermission = reportedPermission(session.data, "approvals.decide");
  const permissionNotice = permissionCapability(preparePermission);

  return (
    <>
      <PageHeader breadcrumbs={["Governance"]} title="Governed operations" description="Remediation plans, approvals, owners, and audit events for manual cloud operations." />
      <ErrorAndRefresh error={plans.error || approvals.error || activity.error || session.error} isRefreshing={plans.isRefreshing || approvals.isRefreshing || activity.isRefreshing || session.isRefreshing} />
      <InlineNotice title="Approval required" tone="info">Operational work is tracked through plans, approvals, owners, and completion evidence.</InlineNotice>
      <PermissionRestriction capability={permissionNotice} />
      <StatGroup>
        <MetricTile label="Plans" value={planRows.length} />
        <MetricTile label="Pending approvals" value={approvalRows.filter((row: AnyRecord) => String(row.status).toUpperCase().includes("PENDING")).length} tone="warning" />
        <MetricTile label="Completed" value={planRows.filter((row: AnyRecord) => String(row.executionStatus ?? row.status).toUpperCase().includes("COMPLETED")).length} tone="success" />
      </StatGroup>
      <div className="cs-two-column">
        <Section title="Remediation plans">
          <DataTable
            columns={["Plan", "Approval", "Execution", "Updated", "Action availability"]}
            rows={planRows.map((plan) => [
              text(plan.title),
              <StatusBadge key="approval" status={plan.approvalStatus} />,
              <StatusBadge key="status" status={plan.mutationOutcome ?? plan.executionStatus} />,
              formatDate(plan.updatedAt),
              <GovernancePlanAction key="action" capability={resolvePlanExecutionCapability({
                permission: preparePermission,
                executionMode: plan.executionMode,
                lifecycleState: plan.lifecycleState,
                approvalStatus: plan.approvalStatus,
                approvalExpiresAt: plan.approvalExpiresAt,
                mutationOutcome: plan.mutationOutcome,
                reconciliationStatus: plan.reconciliationStatus
              })} guidance={plan.operatorGuidance} />
            ])}
          />
        </Section>
        <Section title="Approval requests">
          <DataTable
            columns={["Plan", "Status", "Requested", "Decision availability"]}
            rows={approvalRows.map((approval) => [
              text(approval.remediationPlanTitle, "Remediation plan"),
              <StatusBadge key="status" status={approval.status} />,
              formatDate(approval.createdAt),
              <GuardedAction key="action" capability={resolveApprovalCapability({
                permission: approvalPermission,
                status: approval.status,
                requestedById: approval.requestedById,
                currentUserId: session.data?.user.id,
                payloadIntegrityBound: approval.payloadIntegrityBound,
                expiresAt: approval.expiresAt
              })}>Review approval</GuardedAction>
            ])}
          />
        </Section>
        <Section title="Governance activity">
          <Timeline
            events={(activity.data?.items ?? []).slice(0, 8).map((event) => ({
              title: event.action,
              description: event.targetType,
              time: event.createdAt
            }))}
          />
        </Section>
      </div>
    </>
  );
}

export function AutomationView() {
  const { data, error, isRefreshing, refetch } = useCloudShieldData<FrontendAutomationLatest | null>("/api/v1/automation/latest", null, { schema: FrontendAutomationLatestSchema });
  const jobs = data?.events ?? [];

  return (
    <>
      <PageHeader breadcrumbs={["Operations", "Automation"]} title="Automation center" description="Latest advisory automation runs, job outcomes, and report workflow status." />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} onRetry={refetch} />
      <CapabilityNotice capability={unknownBlockReasonCapability()} title="Automation action unavailable" />
      <StatGroup>
        <MetricTile label="Latest status" value={<StatusBadge status={data?.assessment?.status ?? "NOT_CONFIGURED"} />} />
        <MetricTile label="Runs" value={jobs.length} />
        <MetricTile label="Updated" value={formatDate(data?.assessment?.updatedAt)} />
      </StatGroup>
      <Section title="Automation runs">
        <DataTable
          columns={["Run", "Status", "Summary", "Updated"]}
          rows={jobs.map((job) => [
            text(job.type ?? job.id, "Automation event"),
            <StatusBadge key="status" status={job.status} />,
            text(job.message),
            formatDate(job.createdAt)
          ])}
        />
      </Section>
      <Section title="Mutation automation">
        <GuardedAction capability={unknownBlockReasonCapability()}>Start mutation automation</GuardedAction>
      </Section>
    </>
  );
}

export function ComplianceView() {
  const { data, error, isRefreshing } = useCloudShieldData<FrontendComplianceEvidenceCenter | null>("/api/v1/compliance/evidence-center", null, { schema: FrontendComplianceEvidenceCenterSchema });
  const controls = data?.controls ?? [];

  return (
    <>
      <PageHeader breadcrumbs={["Security", "Compliance"]} title="Compliance evidence" description="Control status, evidence records, and framework mapping produced by the evidence center." />
      <ErrorAndRefresh error={error} isRefreshing={isRefreshing} />
      <StatGroup>
        <MetricTile label="Controls" value={controls.length} />
        <MetricTile label="Passing" value={controls.filter((control) => String(control.status).toUpperCase().includes("PASS")).length} tone="success" />
        <MetricTile label="Needs review" value={controls.filter((control) => String(control.status).toUpperCase().includes("FAIL") || String(control.status).toUpperCase().includes("REVIEW")).length} tone="warning" />
      </StatGroup>
      <Section title="Control evidence">
        <DataTable
          columns={["Control", "Framework", "Status", "Evidence", "Source"]}
          rows={controls.map((control) => [
            text(control.title ?? control.controlId, "Control"),
            text(control.framework),
            <StatusBadge key="status" status={control.status} />,
            text(control.evidenceCount),
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
