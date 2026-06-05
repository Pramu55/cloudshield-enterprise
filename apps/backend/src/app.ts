import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
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

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify(opts);

  await app.register(helmet);
  await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
  });

  await registerEnvPlugin(app);
  registerErrorPlugin(app);



  await registerPlatformRoutes(app);
  await registerAuthRoutes(app);
  await registerAwsAccountRoutes(app);
  await registerAwsConnectorRoutes(app);
  await registerAwsInventoryRoutes(app);
  await registerSecurityPostureRoutes(app);
  await registerRiskWorkflowRoutes(app);
  await registerComplianceEvidenceRoutes(app);
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
