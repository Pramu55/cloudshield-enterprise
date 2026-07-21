import { z } from "zod";

export const LOCAL_DEMO_JWT_SECRET = "cloudshield-local-demo-jwt-secret-change-me";
export const LOCAL_DEMO_CSRF_HMAC_KEY = "cloudshield-local-demo-csrf-hmac-key-change-me";

const SECRET_MIN_LENGTH = 32;
const KNOWN_INSECURE_SECRET_VALUES = new Set([
  LOCAL_DEMO_JWT_SECRET,
  LOCAL_DEMO_CSRF_HMAC_KEY,
  "change-me",
  "change_me",
  "changeme",
  "placeholder",
  "replace-me",
  "replace_me"
]);

const EnvBooleanSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return value;
}, z.boolean());

export const RuntimeEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_URL: z.string().optional(),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: EnvBooleanSchema.optional(),
  JWT_SECRET: z.string().min(16).default(LOCAL_DEMO_JWT_SECRET),
  CSRF_HMAC_KEY: z.string().min(16).default(LOCAL_DEMO_CSRF_HMAC_KEY),
  FRONTEND_URL: z.string().optional().default(""),
  PUBLIC_FRONTEND_ORIGIN: z.string().optional().default(""),
  TRUST_PROXY: EnvBooleanSchema.default(false),
  CLOUDSHIELD_DATA_MODE: z
    .enum(["production", "development", "sample"])
    .default("development"),
  AUTH_COOKIE_SECURE: EnvBooleanSchema.default(false),
  AUTH_COOKIE_DOMAIN: z.string().optional().default(""),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  AWS_CONNECTOR_MODE: z
    .enum(["disabled", "readonly-validation", "sts-validation"])
    .default("disabled"),
  AWS_INVENTORY_SCANNER_MODE: z
    .enum(["disabled", "readonly-plan", "readonly", "readonly-scan"])
    .default("disabled"),
  AWS_REGION_DEFAULT: z.string().min(1).default("us-east-1"),
  AWS_ROLE_ARN: z.string().optional().default(""),
  AWS_EXTERNAL_ID: z.string().optional().default(""),
  AWS_EXECUTOR_ROLE_ARN: z.string().optional().default(""),
  AWS_EXECUTOR_EXTERNAL_ID: z.string().optional().default(""),
  AWS_ALLOWED_ACCOUNT_IDS: z.string().optional().default(""),
  AWS_ALLOWED_REGIONS: z.string().optional().default(""),
  AWS_CHANGE_EXECUTION_MODE: z
    .enum(["disabled", "simulation", "staging", "production"])
    .default("disabled"),
  CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS: z.string().optional().default(
    "CloudShieldManaged,CloudShieldOwner,CloudShieldEnvironment,CloudShieldReviewDate"
  ),
  LOG_LEVEL: z.string().optional().default("info"),
  MONITORING_ENABLED: EnvBooleanSchema.default(false),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(7)
});

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

export function loadRuntimeEnv(source: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  const parsed = RuntimeEnvSchema.parse(source);
  validateProductionRuntimeEnv(parsed, source);
  return parsed;
}

export function resolveFrontendOrigin(env: RuntimeEnv): string {
  return (env.FRONTEND_URL || env.PUBLIC_FRONTEND_ORIGIN).trim();
}

function validateProductionRuntimeEnv(env: RuntimeEnv, source: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== "production") return;

  const failures: string[] = [];
  assertProductionSecret("JWT_SECRET", source.JWT_SECRET, failures);
  assertProductionSecret("CSRF_HMAC_KEY", source.CSRF_HMAC_KEY, failures);

  if (!env.AUTH_COOKIE_SECURE) {
    failures.push("AUTH_COOKIE_SECURE must be true in production.");
  }

  const frontendOrigin = resolveFrontendOrigin(env);
  if (!frontendOrigin) {
    failures.push("FRONTEND_URL or PUBLIC_FRONTEND_ORIGIN is required in production.");
  } else if (!isSafeProductionOrigin(frontendOrigin)) {
    failures.push("FRONTEND_URL or PUBLIC_FRONTEND_ORIGIN must be an exact https origin and must not be localhost.");
  }

  const cookieDomain = env.AUTH_COOKIE_DOMAIN.trim();
  if (cookieDomain && isLocalHostname(cookieDomain.replace(/^\./, ""))) {
    failures.push("AUTH_COOKIE_DOMAIN must not target localhost in production.");
  }

  if (failures.length > 0) {
    throw new Error(`Invalid production runtime configuration: ${failures.join(" ")}`);
  }
}

function assertProductionSecret(name: string, rawValue: string | undefined, failures: string[]): void {
  const value = rawValue?.trim() ?? "";
  if (!value) {
    failures.push(`${name} is required in production.`);
    return;
  }
  if (value.length < SECRET_MIN_LENGTH) {
    failures.push(`${name} must be at least ${SECRET_MIN_LENGTH} characters in production.`);
    return;
  }
  if (KNOWN_INSECURE_SECRET_VALUES.has(value) || value.toLowerCase().includes("change-me")) {
    failures.push(`${name} must not use a development, demo, or placeholder value in production.`);
  }
}

function isSafeProductionOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.origin === value.replace(/\/$/, "") &&
      !isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost");
}
