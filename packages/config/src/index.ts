import { z } from "zod";

export const RuntimeEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  JWT_SECRET: z.string().min(16).default("cloudshield-local-demo-jwt-secret-change-me")
});

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

export function loadRuntimeEnv(source: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  return RuntimeEnvSchema.parse(source);
}
