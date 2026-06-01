import type { FastifyInstance } from "fastify";
import {
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
    const payload = PlatformStatusSchema.parse({
      name: PLATFORM_NAME,
      title: PLATFORM_TITLE,
      milestone: "CLOUDSHIELD_TECH_STACK_AND_STRUCTURE_UPGRADE_GREEN",
      apiVersion: "v1",
      remediationExecution: "disabled",
      awsScanner: "not_configured",
      safetyMode: "read_only"
    });

    return {
      ...payload,
      backend: "Fastify 5",
      contracts: "Zod 4",
      complianceLanguage: [
        "CIS-inspired controls",
        "SOC2-inspired evidence",
        "internal cloud governance evidence"
      ],
      recommendationSafety: recommendationExecutionPolicy()
    };
  });
}
