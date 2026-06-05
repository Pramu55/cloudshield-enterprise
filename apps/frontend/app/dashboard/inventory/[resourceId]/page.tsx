"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Database, ShieldAlert } from "lucide-react";
import { RefreshBadge, useCloudShieldData } from "../../../../lib/client-api";
import { ActivityTimeline, DashboardPage, InsightPanel, PremiumDataTable, StatusMatrix, WorkspaceHero } from "../../shared";

type ResourceDetail = {
  resource: {
    id: string;
    externalId: string;
    arn: string | null;
    account: { id: string; name: string; accountId: string; environment: string };
    region: string | null;
    resourceType: string;
    name: string | null;
    state: string | null;
    source: string;
    firstSeenAt: string;
    lastSeenAt: string | null;
    lastVerifiedAt: string | null;
    staleAt: string | null;
    tags: Record<string, unknown>;
    metadata: Record<string, unknown>;
    executionEligibility: { eligible: boolean; blockedReason: string | null };
  };
  relationships: Array<{ id: string; relationshipType: string; direction: string; target: { name: string | null; resourceId: string; resourceType: string } }>;
  securityFindings: Array<{ id: string; title: string; severity: string; status: string; ruleId: string }>;
  costFindings: Array<{ id: string; title: string; severity: string; estimatedMonthlyWaste: string }>;
  complianceEvidence: Array<{ id: string; status: string; source: string; evidenceType: string; control: { controlId: string; title: string } }>;
  remediationPlans: Array<{ id: string; title: string; lifecycleState: string; approvalStatus: string; executionStatus: string }>;
  activity: Array<{ id: string; action: string; createdAt: string }>;
  awsApiCallExecuted: false;
  mutationExecuted: false;
};

const EmptyDetail: ResourceDetail = {
  resource: {
    id: "",
    externalId: "",
    arn: null,
    account: { id: "", name: "Loading", accountId: "", environment: "" },
    region: null,
    resourceType: "",
    name: "Loading resource",
    state: null,
    source: "SYSTEM",
    firstSeenAt: new Date(0).toISOString(),
    lastSeenAt: null,
    lastVerifiedAt: null,
    staleAt: null,
    tags: {},
    metadata: {},
    executionEligibility: { eligible: false, blockedReason: "Loading resource detail." }
  },
  relationships: [],
  securityFindings: [],
  costFindings: [],
  complianceEvidence: [],
  remediationPlans: [],
  activity: [],
  awsApiCallExecuted: false,
  mutationExecuted: false
};

export default function ResourceDetailPage() {
  const params = useParams<{ resourceId: string }>();
  const resourceId = params.resourceId;
  const { data, error, isRefreshing } = useCloudShieldData<ResourceDetail>(
    `/api/v1/platform/resources/${resourceId}/detail`,
    EmptyDetail
  );

  return (
    <DashboardPage
      title="Resource Record"
      description="Canonical resource detail with safe metadata, source classification, relationships, findings, evidence, and operations."
    >
      <Link className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-700" href="/dashboard/inventory">
        <ArrowLeft size={16} />
        Inventory
      </Link>
      <RefreshBadge error={error} isRefreshing={isRefreshing} />
      <WorkspaceHero
        eyebrow="Resource operational record"
        title={data.resource.name ?? data.resource.externalId}
        description={`${data.resource.resourceType} / ${data.resource.account.name} / ${data.resource.region ?? "global"}`}
        icon={<Database size={20} />}
        badges={[
          { label: data.resource.source, tone: data.resource.source === "AWS_SYNC" ? "good" : "warning" },
          { label: data.resource.executionEligibility.eligible ? "Execution eligible" : "Execution blocked", tone: data.resource.executionEligibility.eligible ? "good" : "warning" },
          { label: "Safe metadata only", tone: "good" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "AWS API", value: data.awsApiCallExecuted, tone: "good" },
            { label: "Mutation", value: data.mutationExecuted, tone: "good" },
            { label: "Last seen", value: data.resource.lastSeenAt ? new Date(data.resource.lastSeenAt).toLocaleString() : "never", tone: "info" }
          ]}
        />
      </WorkspaceHero>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel title="Evidence summary" description="Linked operational records scoped to this resource.">
          <StatusMatrix
            items={[
              { label: "Security findings", value: data.securityFindings.length, tone: "danger" },
              { label: "Cost findings", value: data.costFindings.length, tone: "warning" },
              { label: "Compliance evidence", value: data.complianceEvidence.length, tone: "info" },
              { label: "Relationships", value: data.relationships.length, tone: "good" },
              { label: "Operations", value: data.remediationPlans.length, tone: "info" },
              { label: "Activity events", value: data.activity.length, tone: "info" }
            ]}
          />
        </InsightPanel>
        <InsightPanel title="Execution eligibility" description="Sample and non-AWS_SYNC resources remain blocked.">
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <ShieldAlert size={16} />
              {data.resource.executionEligibility.eligible ? "Eligible for governed pilot" : "Blocked"}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {data.resource.executionEligibility.blockedReason ?? "Resource-level gates are satisfied. Approval and confirmation are still required."}
            </p>
          </div>
        </InsightPanel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <InsightPanel title="Safe metadata" description="Only allowlisted metadata keys are rendered.">
          <PremiumDataTable
            columns={["Key", "Value"]}
            rows={Object.entries(data.resource.metadata).map(([key, value]) => [key, String(value)])}
          />
        </InsightPanel>
        <InsightPanel title="Tags" description="Resource tag map stored separately from metadata.">
          <PremiumDataTable
            columns={["Key", "Value"]}
            rows={Object.entries(data.resource.tags).map(([key, value]) => [key, String(value)])}
          />
        </InsightPanel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <InsightPanel title="Security findings" description="Rule-engine findings linked to this resource.">
          <PremiumDataTable
            columns={["Title", "Severity", "Status", "Rule"]}
            rows={data.securityFindings.map((finding) => [finding.title, finding.severity, finding.status, finding.ruleId])}
          />
        </InsightPanel>
        <InsightPanel title="Activity timeline" description="Safe audit history for this resource.">
          <ActivityTimeline
            events={data.activity.map((event) => ({
              title: event.action,
              time: new Date(event.createdAt).toLocaleString(),
              tone: "info"
            }))}
          />
        </InsightPanel>
      </section>
    </DashboardPage>
  );
}
