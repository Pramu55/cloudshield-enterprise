import { z } from "zod";

export const RuntimeEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  JWT_SECRET: z.string().min(16).default("cloudshield-local-demo-jwt-secret-change-me"),
  AWS_CONNECTOR_MODE: z
    .enum(["disabled", "readonly-validation", "sts-validation"])
    .default("disabled"),
  AWS_INVENTORY_SCANNER_MODE: z
    .enum(["disabled", "readonly-plan", "readonly", "readonly-scan"])
    .default("disabled"),
  AWS_REGION_DEFAULT: z.string().min(1).default("us-east-1"),
  AWS_ROLE_ARN: z.string().optional().default(""),
  AWS_EXTERNAL_ID: z.string().optional().default("")
});

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

export function loadRuntimeEnv(source: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  return RuntimeEnvSchema.parse(source);
}
