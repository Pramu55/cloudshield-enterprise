"use client";

import type { AwsInventoryPlanResponse } from "@cloudshield/contracts";
import { ShieldAlert } from "lucide-react";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";
import { DashboardPage } from "../shared";

const InstantInventoryPlan: AwsInventoryPlanResponse = {
  scannerMode: "disabled",
  inventoryScanningEnabled: false,
  mutationEnabled: false,
  automaticRemediationEnabled: false,
  terraformApplyEnabled: false,
  awsApiCallExecuted: false,
  supportedResourceTypes: [
    "EC2_INSTANCE",
    "S3_BUCKET",
    "IAM_USER",
    "IAM_ROLE",
    "IAM_ACCESS_KEY",
    "SECURITY_GROUP",
    "EBS_VOLUME",
    "VPC",
    "SUBNET"
  ],
  allowedReadOnlyApis: [
    {
      service: "sts",
      operation: "GetCallerIdentity",
      resourceType: "AWS_ACCOUNT",
      category: "identity",
      riskLevel: "low",
      mutationAllowed: false,
      enabledInCurrentMilestone: true,
      notes: "Identity validation only when explicitly configured."
    },
    {
      service: "ec2",
      operation: "DescribeInstances",
      resourceType: "EC2_INSTANCE",
      category: "compute",
      riskLevel: "low",
      mutationAllowed: false,
      enabledInCurrentMilestone: false,
      notes: "Planned future read-only inventory API. Not executed yet."
    },
    {
      service: "s3",
      operation: "ListBuckets",
      resourceType: "S3_BUCKET",
      category: "storage",
      riskLevel: "low",
      mutationAllowed: false,
      enabledInCurrentMilestone: false,
      notes: "Planned future read-only inventory API. Not executed yet."
    },
    {
      service: "iam",
      operation: "ListRoles",
      resourceType: "IAM_ROLE",
      category: "iam",
      riskLevel: "medium",
      mutationAllowed: false,
      enabledInCurrentMilestone: false,
      notes: "Planned future read-only inventory API. Not executed yet."
    }
  ],
  blockedMutationPatterns: ["Create*", "Update*", "Delete*", "Put*", "Terraform apply"],
  scanPhases: [
    "Tenant-scoped account selection",
    "STS identity validation gate",
    "Region planning without inventory API execution",
    "Future read-only resource family batching",
    "Future relationship mapping",
    "Disabled execution gate for this milestone"
  ],
  sampleDataLabel:
    "Sample/demo planning data - real AWS inventory scanning is disabled.",
  message:
    "AWS inventory scanner architecture is planned, but scanner execution is disabled in this milestone."
};

export default function ScansPage() {
  const { data, error, isRefreshing } = useCloudShieldData(
    "/api/v1/aws/inventory/plan",
    InstantInventoryPlan
  );

  return (
    <DashboardPage
      title="Read-Only Scanner Plan"
      description="Future AWS inventory collection architecture with scanner execution blocked, mutation disabled, and sample/demo posture clearly labeled."
    >
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <section className="rounded-md border border-warning/50 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" />
              <h3 className="text-sm font-semibold text-ink">
                Scanner execution disabled
              </h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {data.message} {data.sampleDataLabel} CloudShield does not execute
              EC2, S3, IAM, Security Group, EBS, VPC, subnet, or other AWS
              inventory APIs in this milestone.
            </p>
          </div>
          <button
            className="rounded-md border border-line bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
            disabled
            type="button"
            title="AWS inventory scanning is disabled in this milestone."
          >
            Start scan disabled
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Status label="Scanner mode" value={data.scannerMode} />
          <Status label="Inventory enabled" value="false" />
          <Status label="Mutation enabled" value="false" />
          <Status label="AWS API calls" value={String(data.awsApiCallExecuted)} />
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <PlanList title="Planned phases" items={data.scanPhases} />
        <PlanList
          title="Future resource families"
          items={data.supportedResourceTypes.map((item) =>
            item.replaceAll("_", " ")
          )}
        />
        <PlanList
          title="Blocked operations"
          items={data.blockedMutationPatterns}
        />
      </section>

      <section className="mt-6 rounded-md border border-line bg-white p-5">
        <h3 className="text-sm font-semibold text-ink">Read-only API allowlist plan</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Operation</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Current milestone</th>
                <th className="px-4 py-3">Mutation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.allowedReadOnlyApis.map((operation) => (
                <tr key={`${operation.service}:${operation.operation}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {operation.service}
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">
                    {operation.operation}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {operation.resourceType.replaceAll("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {operation.enabledInCurrentMilestone
                      ? "STS identity validation only"
                      : "Planned, not executed"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {String(operation.mutationAllowed)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardPage>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-line bg-white p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
