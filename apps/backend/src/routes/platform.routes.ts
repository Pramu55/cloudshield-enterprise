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

  app.get("/api/v1/platform/status", async () => {
    const milestone = "CLOUDSHIELD_GOVERNED_REAL_WORLD_OPERATIONS_FOUNDATION_GREEN";
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
        "Governance audit activity"
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
