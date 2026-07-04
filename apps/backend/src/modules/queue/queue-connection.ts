import { optionalEnv } from "@cloudshield/utils";

type QueueConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
  maxRetriesPerRequest: null;
};

function parseBooleanEnv(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function parseRedisUrl(redisUrl: string): QueueConnectionOptions {
  const parsed = new URL(redisUrl);

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error("REDIS_URL must start with redis:// or rediss://.");
  }

  const tlsEnabled = parsed.protocol === "rediss:";
  const username = parsed.username ? decodeURIComponent(parsed.username) : "";
  const password = parsed.password ? decodeURIComponent(parsed.password) : "";
  const port = parsed.port ? Number(parsed.port) : tlsEnabled ? 6380 : 6379;

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("REDIS_URL must include a valid Redis port.");
  }

  return {
    host: parsed.hostname,
    port,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(tlsEnabled ? { tls: {} } : {}),
    maxRetriesPerRequest: null
  };
}

export function createQueueConnection(): QueueConnectionOptions {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (redisUrl) {
    return parseRedisUrl(redisUrl);
  }

  const username = process.env.REDIS_USERNAME?.trim();
  const password = process.env.REDIS_PASSWORD?.trim();
  const tlsEnabled = parseBooleanEnv(process.env.REDIS_TLS);

  return {
    host: optionalEnv("REDIS_HOST", "localhost"),
    port: Number(optionalEnv("REDIS_PORT", "6379")),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(tlsEnabled ? { tls: {} } : {}),
    maxRetriesPerRequest: null
  };
}
