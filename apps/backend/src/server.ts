import { loadRuntimeEnv } from "@cloudshield/config";
import { createLogger } from "@cloudshield/logger";
import { buildApp } from "./app.js";

const logger = createLogger("cloudshield-backend");
const env = loadRuntimeEnv();
const app = await buildApp();

try {
  await app.listen({
    host: "0.0.0.0",
    port: env.PORT
  });

  logger.info({ port: env.PORT }, "CloudShield Fastify backend listening");
} catch (error) {
  logger.error({ error }, "CloudShield backend failed to start");
  process.exit(1);
}
