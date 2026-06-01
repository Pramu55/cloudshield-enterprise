import type { FastifyInstance } from "fastify";
import { loadRuntimeEnv, type RuntimeEnv } from "@cloudshield/config";

declare module "fastify" {
  interface FastifyInstance {
    config: RuntimeEnv;
  }
}

export async function registerEnvPlugin(app: FastifyInstance): Promise<void> {
  app.decorate("config", loadRuntimeEnv());
}
