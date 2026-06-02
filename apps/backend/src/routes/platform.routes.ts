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
    const milestone = "CLOUDSHIELD_ENTERPRISE_CLIENT_PLATFORM_BLUEPRINT_GREEN";
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
      implementedCapabilities: [
        "organization-scoped authentication foundation",
        "AWS account registry metadata workflow",
        "read-only AWS connector status and STS identity validation path",
        "sample/demo governance data for local evaluation",
        "non-executable remediation recommendation model"
      ],
      disabledCapabilities: [
        "AWS inventory scanner execution",
        "AWS mutation and remediation execution",
        "Terraform apply",
        "official compliance certification claims",
        "production identity provider and enterprise RBAC"
      ],
      enterpriseReadinessNotes: [
        "Tenant-owned data must be scoped by organizationId.",
        "Sample/demo records are clearly labeled and are not real AWS inventory claims.",
        "Recommendations remain review-only with execution blocked.",
        "CloudShield is enterprise-client-ready for consulting demos, not deployed to a named customer."
      ]
    });
  });
}
