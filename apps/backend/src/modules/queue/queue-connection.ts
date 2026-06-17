import { optionalEnv } from "@cloudshield/utils";

export function createQueueConnection() {
  return {
    host: optionalEnv("REDIS_HOST", "localhost"),
    port: Number(optionalEnv("REDIS_PORT", "6379")),
    maxRetriesPerRequest: null
  };
}
