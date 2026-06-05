import type { FastifyInstance } from "fastify";
import {
  EnterprisePlatformStatusSchema,
  HealthResponseSchema,
  PLATFORM_NAME,
  PLATFORM_TITLE,
  PlatformStatusSchema
} from "@cloudshield/contracts";
import { recommendationExecutionPolicy } from "@cloudshield/security";
import { nowIso } from "@cloudshield/utils";
import { getAwsCredentialReadiness } from "../modules/aws-readiness/aws-credential-readiness.js";

export async function registerPlatformRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return HealthResponseSchema.parse({
      status: "ok",
      service: "backend",
      timestamp: nowIso()
    });
  });

  app.get("/ready", async () => {
    return {
      status: "ready",
      service: "backend",
      dependencies: {
        postgres: "configured",
        redis: "configured"
      },
      timestamp: nowIso()
    };
  });

  app.get("/api/v1/platform/sandbox-readiness", async () => {
    const allowedAccountIds = parseCsv(app.config.AWS_ALLOWED_ACCOUNT_IDS);
    const allowedRegions = parseCsv(app.config.AWS_ALLOWED_REGIONS);
    const scannerConfigured = Boolean(
      app.config.AWS_ROLE_ARN && app.config.AWS_EXTERNAL_ID
    );
    const executorConfigured = Boolean(
      app.config.AWS_EXECUTOR_ROLE_ARN && app.config.AWS_EXECUTOR_EXTERNAL_ID
    );
    const productionBlocked = app.config.AWS_CHANGE_EXECUTION_MODE !== "production";

    return {
      status: scannerConfigured ? "READY_FOR_AUTHORIZED_VALIDATION" : "NOT_CONFIGURED",
      milestone: "CLOUDSHIELD_COMPANY_SANDBOX_DEPLOYMENT_FOUNDATION_GREEN",
      realAwsSandboxValidation: "AUTHORIZATION_REQUIRED",
      awsConnectorMode: app.config.AWS_CONNECTOR_MODE,
      awsInventoryScannerMode: app.config.AWS_INVENTORY_SCANNER_MODE,
      awsChangeExecutionMode: app.config.AWS_CHANGE_EXECUTION_MODE,
      scannerRoleConfigured: scannerConfigured,
      executorRoleConfigured: executorConfigured,
      allowedAccountIdsConfigured: allowedAccountIds.length > 0,
      allowedRegionsConfigured: allowedRegions.length > 0,
      allowedRegionCount: allowedRegions.length,
      allowedAccountCount: allowedAccountIds.length,
      monitoringEnabled: app.config.MONITORING_ENABLED,
      backupRetentionDays: app.config.BACKUP_RETENTION_DAYS,
      guardrails: {
        productionBlocked,
        automaticRemediationEnabled: false,
        terraformApplyEnabled: false,
        arbitraryAwsSdkCommandsEnabled: false,
        permittedMutation: "EC2_APPLY_GOVERNANCE_TAGS",
        confirmationRequired: "APPLY_GOVERNANCE_TAGS",
        secretsReturned: false
      },
      authorizationCheckpoint: [
        "Configure scanner and executor role values in the secure runtime environment.",
        "Use only a dedicated non-production AWS sandbox account.",
        "Authorize STS validation before any real AWS call.",
        "Authorize read-only inventory sync separately.",
        "Authorize the governed tagging action only after reviewing simulation and approval evidence."
      ],
      timestamp: nowIso()
    };
  });

  app.get("/api/v1/platform/status", async () => {
    const milestone = "CLOUDSHIELD_AI_AUTOMATION_AND_INTELLIGENCE_FOUNDATION_GREEN";
    const payload = PlatformStatusSchema.parse({
      name: PLATFORM_NAME,
      title: PLATFORM_TITLE,
      milestone,
      apiVersion: "v1",
      remediationExecution: "disabled",
      awsScanner: "not_configured",
      safetyMode: "read_only"
    });

    return EnterprisePlatformStatusSchema.parse({
      ...payload,
      platformName: PLATFORM_NAME,
      platformCategory:
        "Enterprise AWS Security Posture, Cost Governance & Compliance Evidence Platform",
      currentMilestone: milestone,
      awsConnectorMode: app.config.AWS_CONNECTOR_MODE,
      inventoryScanningEnabled: false,
      mutationEnabled: false,
      remediationExecutionEnabled: false,
      awsApiCallExecuted: false,
      scannerRun: false,
      terraformApplyExecuted: false,
      automaticRemediationExecuted: false,
      sampleDataMode: true,
      backend: "Fastify 5",
      contracts: "Zod 4",
      complianceLanguage: [
        "CIS-inspired controls",
        "SOC2-inspired evidence",
        "internal cloud governance evidence"
      ],
      recommendationSafety: recommendationExecutionPolicy(),
      credentialReadiness: getAwsCredentialReadiness(app.config),
      implementedCapabilities: [
        "Local Runtime Foundation",
        "Tenant & Auth Boundaries",
        "AWS Account Registry",
        "AWS Read-Only Connector (Planned)",
        "Security Posture Rules Engine",
        "Risk Workflow & Ownership",
        "Compliance Evidence Center",
        "Reports & Exports Foundation",
        "Executive Dashboard & Demo Flow",
        "AWS credential readiness metadata foundation",
        "Governed remediation planning",
        "Approval-based manual execution workflow",
        "Governance audit activity",
        "DB-backed dynamic operations timeline",
        "Resource relationship graph",
        "Scan lifecycle readiness workspace",
        "Report evidence summary",
        "AI-assisted deterministic assessment engine",
        "Automation assessment timeline",
        "Intelligence summary generation"
      ],
      disabledCapabilities: [
        "Live AWS Mutation",
        "Automatic Remediation",
        "Terraform Apply",
        "Live AWS API Calls"
      ],
      enterpriseReadinessNotes: [
        "CloudShield is an enterprise AWS governance platform for security, compliance, and cost.",
        "Governed operations workflows create remediation plans, approval requests, audit evidence, and manual execution records.",
        "AWS mutation execution, Terraform apply, and automatic remediation remain disabled.",
        "Compliance references are CIS-inspired and SOC2-inspired; no official certification is claimed.",
        "CloudShield records all governed workflow actions in tenant-scoped audit events."
      ]
    });
  });
}

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
