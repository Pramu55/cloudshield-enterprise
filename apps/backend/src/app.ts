import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastifyCookie from "@fastify/cookie";
import fastifyCsrfProtection from "@fastify/csrf-protection";
import rateLimit from "@fastify/rate-limit";
import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import { registerEnvPlugin } from "./plugins/env.js";
import { registerErrorPlugin } from "./plugins/errors.js";
import { registerAwsAccountRoutes } from "./routes/aws-account.routes.js";
import { registerAwsConnectorRoutes } from "./routes/aws-connector.routes.js";
import { registerAwsInventoryRoutes } from "./routes/aws-inventory.routes.js";
import { registerSecurityPostureRoutes } from "./routes/security-posture.routes.js";
import { registerRiskWorkflowRoutes } from "./routes/risk-workflow.routes.js";
import { registerComplianceEvidenceRoutes } from "./routes/compliance-evidence.routes.js";
import { registerReportRoutes } from "./routes/report.routes.js";
import { registerRemediationGovernanceRoutes } from "./routes/remediation-governance.routes.js";
import { registerDataRoutes } from "./routes/data.routes.js";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerPlatformRoutes } from "./routes/platform.routes.js";
import { registerPlatformDynamicRoutes } from "./routes/platform-dynamic.routes.js";
import { registerOperationsRoutes } from "./routes/operations.routes.js";
import { registerAutomationRoutes } from "./routes/automation.routes.js";
import { registerPlatformCoreRoutes } from "./routes/platform-core.routes.js";
import { registerMembersRoutes } from "./routes/members.routes.js";
import { registerTeamsRoutes } from "./routes/teams.routes.js";
export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify(opts);

  await app.register(helmet);

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3100";
  await app.register(cors, {
    origin: frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
    const origin = request.headers.origin;
    if (origin && origin !== frontendUrl) {
      return reply.status(403).send({
        error: "unexpected_origin",
        message: "Request origin is not allowed."
      });
    }
  });

  await app.register(fastifyCookie, {
    secret: process.env.JWT_SECRET || "cloudshield-local-demo-jwt-secret-change-me",
    hook: "onRequest"
  });

  await app.register(fastifyCsrfProtection, {
    sessionPlugin: "@fastify/cookie",
    csrfOpts: {
      userInfo: true,
      hmacKey: process.env.CSRF_HMAC_KEY || "cloudshield-local-demo-csrf-hmac-key-change-me"
    },
    cookieOpts: {
      signed: false,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.AUTH_COOKIE_SECURE === "true"
    },
    getUserInfo: (req) => req.cookies.cloudshield_session || "guest"
  });

  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 minute"
  });

  await registerEnvPlugin(app);
  registerErrorPlugin(app);



  await registerPlatformRoutes(app);
  await registerAuthRoutes(app);
  await registerMembersRoutes(app);
  await registerTeamsRoutes(app);
  await registerAwsConnectorRoutes(app);
  await registerAwsInventoryRoutes(app);
  await registerSecurityPostureRoutes(app);
  await registerRiskWorkflowRoutes(app);
  await registerComplianceEvidenceRoutes(app);
  await registerAwsAccountRoutes(app);
  await registerReportRoutes(app);
  await registerRemediationGovernanceRoutes(app);
  await registerDataRoutes(app);
  await registerPlatformDynamicRoutes(app);
  await registerOperationsRoutes(app);
  await registerAutomationRoutes(app);
  await registerPlatformCoreRoutes(app);

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: "not_found",
      message: "Route not found"
    });
  });

  return app;
}
