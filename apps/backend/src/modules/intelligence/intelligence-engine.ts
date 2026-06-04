import { prisma, scopeByOrganization, type Prisma } from "@cloudshield/database";
import { getAwsCredentialReadiness } from "../aws-readiness/aws-credential-readiness.js";
import type { RuntimeEnv } from "@cloudshield/config";
import type { AutomationAssessmentMode, AutomationSafetyFlags as AutomationSafetyFlagsType } from "@cloudshield/contracts";

export const AutomationSafety: AutomationSafetyFlagsType = {
  awsApiCallExecuted: false,
  scannerRun: false,
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false
};

const severityWeight: Record<string, number> = {
  CRITICAL: 100,
  HIGH: 80,
  MEDIUM: 45,
  LOW: 20,
  INFO: 5
};

const criticalityWeight: Record<string, number> = {
  MISSION_CRITICAL: 30,
  HIGH: 20,
  MEDIUM: 10,
  LOW: 0
};

export type IntelligenceContext = Awaited<ReturnType<typeof loadIntelligenceContext>>;

export function resolveAssessmentMode(config: RuntimeEnv): AutomationAssessmentMode {
  if (
    config.AWS_INVENTORY_SCANNER_MODE === "readonly" ||
    config.AWS_INVENTORY_SCANNER_MODE === "readonly-scan"
  ) {
    return "AWS_READONLY_SCAN";
  }

  if (config.AWS_CONNECTOR_MODE === "readonly-validation" || config.AWS_CONNECTOR_MODE === "sts-validation") {
    return "AWS_STS_ONLY";
  }

  return "EVALUATION";
}

export async function loadIntelligenceContext(organizationId: string, config: RuntimeEnv) {
  const organizationScope = scopeByOrganization(organizationId);
  const [
    accounts,
    resources,
    findings,
    costFindings,
    controls,
    evidence,
    remediationPlans,
    reports,
    scanRuns
  ] = await Promise.all([
    prisma.awsAccount.findMany({ where: organizationScope, include: { ownerTeam: true } }),
    prisma.cloudResource.findMany({ where: organizationScope, include: { awsAccount: true, ownerTeam: true } }),
    prisma.securityFinding.findMany({
      where: { organizationId, archivedAt: null },
      include: { awsAccount: true, resource: true, ownerTeam: true, remediationPlans: true },
      orderBy: [{ severity: "asc" }, { updatedAt: "desc" }],
      take: 100
    }),
    prisma.costFinding.findMany({
      where: organizationScope,
      include: { awsAccount: true, resource: true, ownerTeam: true },
      orderBy: [{ severity: "asc" }, { updatedAt: "desc" }],
      take: 50
    }),
    prisma.complianceControl.findMany({ where: organizationScope, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] }),
    prisma.complianceEvidence.findMany({ where: organizationScope, orderBy: { collectedAt: "desc" }, take: 50 }),
    prisma.remediationPlan.findMany({ where: organizationScope, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.reportExport.findMany({ where: { organizationId, archivedAt: null }, orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }], take: 10 }),
    prisma.scanRun.findMany({ where: organizationScope, orderBy: { startedAt: "desc" }, take: 10 })
  ]);

  return {
    readiness: getAwsCredentialReadiness(config),
    mode: resolveAssessmentMode(config),
    accounts,
    resources,
    findings,
    costFindings,
    controls,
    evidence,
    remediationPlans,
    reports,
    scanRuns
  };
}

export function prioritizeRisks(context: IntelligenceContext) {
  return context.findings
    .map((finding) => {
      const score =
        (severityWeight[finding.severity] ?? 0) +
        (criticalityWeight[finding.awsAccount.criticality] ?? 0) +
        (finding.awsAccount.environment === "prod" ? 15 : 0) +
        (finding.resource?.riskCount ?? 0) * 5;

      return {
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        status: finding.status,
        priority: finding.priority,
        account: finding.awsAccount.name,
        environment: finding.awsAccount.environment,
        businessUnit: finding.awsAccount.businessUnit ?? finding.ownerTeam?.businessUnit ?? "Unassigned",
        resource: finding.resource?.name ?? finding.resource?.resourceId ?? "Account-level",
        score,
        businessImpact:
          finding.businessImpact ??
          "Risk may affect cloud governance posture, audit readiness, or operational resilience.",
        recommendedAction:
          finding.recommendation ??
          "Create an approval-based remediation plan and assign an accountable owner."
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function summarizeFinOpsOpportunities(context: IntelligenceContext) {
  return context.costFindings.slice(0, 8).map((finding) => ({
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    account: finding.awsAccount.name,
    resource: finding.resource?.name ?? finding.resource?.resourceId ?? "Account-level",
    estimatedMonthlyWaste: Number(finding.estimatedMonthlyWaste),
    estimatedAnnualWaste: Number(finding.estimatedAnnualWaste),
    confidence: finding.confidence,
    recommendation:
      finding.recommendation ??
      "Review ownership, usage pattern, and approved retention before any manual change."
  }));
}

export function summarizeCompliancePosture(context: IntelligenceContext) {
  return context.controls
    .filter((control) => ["FAIL", "WARNING", "NEEDS_REVIEW", "NOT_EVALUATED"].includes(control.status))
    .slice(0, 10)
    .map((control) => ({
      id: control.id,
      controlId: control.controlId,
      framework: control.framework,
      title: control.title,
      status: control.status,
      severity: control.severity,
      evidenceCount: control.evidenceCount,
      failedResources: control.failedResources,
      nextStep:
        control.evidenceCount > 0
          ? "Review linked evidence and map owner approval."
          : "Collect evidence from existing CloudShield DB records before audit use."
    }));
}

export function createRemediationPlanDrafts(context: IntelligenceContext) {
  return prioritizeRisks(context).slice(0, 5).map((risk) => ({
    findingId: risk.id,
    title: `AI-assisted advisory plan - ${risk.title}`,
    riskLevel: risk.severity === "CRITICAL" ? "CRITICAL" : risk.severity === "HIGH" ? "HIGH" : "MEDIUM",
    implementationMode: "MANUAL",
    executionStatus: "EXECUTION_BLOCKED",
    approvalStatus: "DRAFT",
    recommendedSteps: [
      "Confirm finding ownership and affected business service.",
      "Validate evidence in CloudShield before preparing any change.",
      "Prepare a manual remediation plan for human approval.",
      "Record approval decision and post-change evidence after manual execution outside CloudShield."
    ],
    safety: "Advisory draft only. No AWS change, Terraform apply, or automatic remediation is executed."
  }));
}

export function generateNextActions(context: IntelligenceContext) {
  const readiness = context.readiness;
  const actions = [
    {
      label: "Review top prioritized risks",
      owner: "Security",
      priority: "P0",
      detail: "Start with critical and high findings on production or mission-critical accounts."
    },
    {
      label: "Convert advisory drafts to approval requests",
      owner: "Governance",
      priority: "P1",
      detail: "Use approval-based remediation planning before any human-executed change."
    },
    {
      label: "Attach report evidence to compliance review",
      owner: "Compliance",
      priority: "P1",
      detail: "Use CloudShield records as internal governance evidence, not as official certification."
    }
  ];

  if (!readiness.roleBasedReadiness) {
    actions.unshift({
      label: "Add environment-only AWS role configuration",
      owner: "Platform",
      priority: "P0",
      detail: "Configure AWS_REGION and AWS_ROLE_ARN outside the database to unlock STS readiness."
    });
  }

  return actions;
}

export function createExecutiveSummary(context: IntelligenceContext) {
  const topRisks = prioritizeRisks(context);
  const highRiskCount = context.findings.filter((finding) => ["CRITICAL", "HIGH"].includes(finding.severity)).length;
  const gapCount = context.controls.filter((control) => ["FAIL", "WARNING", "NEEDS_REVIEW"].includes(control.status)).length;
  const monthlyWaste = context.costFindings.reduce((sum, finding) => sum + Number(finding.estimatedMonthlyWaste), 0);
  const modeLabel =
    context.mode === "EVALUATION"
      ? "evaluation mode with AWS execution disabled"
      : context.mode === "AWS_STS_ONLY"
        ? "STS validation only mode"
        : "guarded read-only inventory readiness mode";

  return `CloudShield completed an AI-assisted deterministic assessment in ${modeLabel}. The engine analyzed ${context.accounts.length} accounts, ${context.resources.length} resources, ${context.findings.length} security findings, ${context.controls.length} controls, and ${context.costFindings.length} FinOps signals from tenant-scoped database records. It identified ${highRiskCount} high-priority security risks, ${gapCount} compliance gaps requiring review, and approximately $${monthlyWaste.toFixed(0)} in monthly cost opportunities. Top attention area: ${topRisks[0]?.title ?? "no open high-priority risk detected"}.`;
}

export function generateAssessmentReport(context: IntelligenceContext, assessmentId: string) {
  const topRisks = prioritizeRisks(context);
  const costOpportunities = summarizeFinOpsOpportunities(context);
  const complianceGaps = summarizeCompliancePosture(context);
  const remediationPlanSummary = createRemediationPlanDrafts(context);
  const nextActions = generateNextActions(context);

  return {
    assessmentId,
    executiveSummary: createExecutiveSummary(context),
    topRisks,
    costOpportunities,
    complianceGaps,
    remediationPlanSummary,
    nextActions,
    safetyNotes: {
      mode: context.mode,
      awsExecutionDisabled: context.mode === "EVALUATION",
      credentialStorageMode: "environment-only",
      noAwsMutation: true,
      noTerraformApply: true,
      noAutomaticRemediationExecution: true,
      generatedBy: "CloudShield deterministic intelligence engine"
    },
    counts: {
      accounts: context.accounts.length,
      resources: context.resources.length,
      securityFindings: context.findings.length,
      costFindings: context.costFindings.length,
      complianceControls: context.controls.length,
      evidenceRecords: context.evidence.length,
      remediationPlans: context.remediationPlans.length,
      reports: context.reports.length,
      scanRuns: context.scanRuns.length
    }
  };
}

export function toJsonObject(value: unknown): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

export function toJsonArray(value: unknown): Prisma.InputJsonArray {
  return value as Prisma.InputJsonArray;
}
