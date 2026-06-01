import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createLogger } from "@cloudshield/logger";
import {
  HealthResponseSchema,
  PLATFORM_NAME,
  PLATFORM_TITLE,
  PlatformStatusSchema,
  REMEDIATION_BLOCKED_REASON
} from "@cloudshield/types";
import { nowIso, parsePort } from "@cloudshield/utils";

const logger = createLogger("cloudshield-api");
const app = express();
const port = parsePort(process.env.PORT, 4000);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  const payload = HealthResponseSchema.parse({
    status: "ok",
    service: "api",
    timestamp: nowIso()
  });

  res.status(200).json(payload);
});

app.get("/ready", (_req, res) => {
  res.status(200).json({
    status: "ready",
    service: "api",
    dependencies: {
      postgres: "configured",
      redis: "configured"
    },
    timestamp: nowIso()
  });
});

app.get("/api/v1/platform/status", (_req, res) => {
  const payload = PlatformStatusSchema.parse({
    name: PLATFORM_NAME,
    title: PLATFORM_TITLE,
    milestone: "CLOUDSHIELD_ENTERPRISE_FOUNDATION_GREEN",
    apiVersion: "v1",
    remediationExecution: "disabled",
    awsScanner: "not_configured",
    safetyMode: "read_only"
  });

  res.status(200).json({
    ...payload,
    complianceLanguage: [
      "CIS-inspired controls",
      "SOC2-inspired evidence",
      "internal cloud governance evidence"
    ],
    recommendationSafety: {
      canExecute: false,
      blockedReason: REMEDIATION_BLOCKED_REASON
    }
  });
});

app.use((_req, res) => {
  res.status(404).json({
    error: "not_found",
    message: "Route not found"
  });
});

app.listen(port, () => {
  logger.info({ port }, "CloudShield API listening");
});
