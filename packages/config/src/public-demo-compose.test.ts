import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const publicDemoCompose = readFileSync(join(process.cwd(), "docker-compose.public-demo.yml"), "utf8");
const configSource = readFileSync(join(process.cwd(), "packages/config/src/index.ts"), "utf8");
const composeArgs = [
  "compose",
  "--project-name",
  "cloudshield-runtime-readiness-gate2c",
  "-f",
  "docker-compose.yml",
  "-f",
  "docker-compose.public-demo.yml",
  "config",
  "--format",
  "json"
];
const syntheticComposeEnv: Record<string, string> = {
  POSTGRES_PASSWORD: "synthetic-local-postgres-password-at-least-thirty-two-chars",
  JWT_SECRET: "synthetic-local-jwt-secret-at-least-thirty-two-chars",
  CSRF_HMAC_KEY: "synthetic-local-csrf-secret-at-least-thirty-two-chars",
  PUBLIC_DEMO_NODE_ENV: "development",
  FRONTEND_URL: "http://localhost:3100",
  PUBLIC_FRONTEND_ORIGIN: "http://localhost:3100",
  PUBLIC_API_BASE_URL: "http://localhost:4100",
  AUTH_COOKIE_SECURE: "false",
  TRUST_PROXY: "false"
};

function serviceBlock(serviceName: string): string {
  const lines = publicDemoCompose.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${serviceName}:`);
  assert.notEqual(start, -1, `${serviceName} service block should exist`);
  const end = lines.findIndex((line, index) => index > start && (/^  [a-z][a-z0-9_-]*:$/.test(line) || line === "volumes:"));
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
}

function renderCompose(overrides: Record<string, string | null> = {}) {
  const env = { ...process.env, ...syntheticComposeEnv };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  const output = execFileSync("docker", composeArgs, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(output) as {
    services: Record<string, { environment?: Record<string, string>; ports?: Array<{ published?: string; target?: number }> }>;
  };
}

function requireService(
  rendered: ReturnType<typeof renderCompose>,
  serviceName: string
): { environment?: Record<string, string>; ports?: Array<{ published?: string; target?: number }> } {
  const service = rendered.services[serviceName];
  assert.ok(service, `${serviceName} service should render`);
  return service;
}

function assertEnvPresent(env: Record<string, string> | undefined, key: string) {
  assert.ok(env && Object.hasOwn(env, key), `${key} should be wired`);
}

function assertEnvAbsent(env: Record<string, string> | undefined, key: string) {
  assert.ok(!env || !Object.hasOwn(env, key), `${key} should not be wired`);
}

test("public-demo backend wires required local runtime auth and origin settings", () => {
  const backend = serviceBlock("backend");

  assert.match(backend, /NODE_ENV: "\$\{PUBLIC_DEMO_NODE_ENV:-development\}"/);
  assert.match(backend, /JWT_SECRET: "\$\{JWT_SECRET:\?Set JWT_SECRET/);
  assert.match(backend, /CSRF_HMAC_KEY: "\$\{CSRF_HMAC_KEY:\?Set CSRF_HMAC_KEY/);
  assert.match(backend, /AUTH_COOKIE_SECURE: "\$\{AUTH_COOKIE_SECURE:-false\}"/);
  assert.match(backend, /TRUST_PROXY: "\$\{TRUST_PROXY:-false\}"/);
  assert.match(backend, /FRONTEND_URL: "\$\{FRONTEND_URL:-http:\/\/localhost:3100\}"/);
  assert.match(backend, /PUBLIC_FRONTEND_ORIGIN: "\$\{PUBLIC_FRONTEND_ORIGIN:-http:\/\/localhost:3100\}"/);
});

test("public-demo backend and worker keep AWS modes disabled", () => {
  for (const serviceName of ["backend", "worker"]) {
    const block = serviceBlock(serviceName);
    assert.match(block, /AWS_CONNECTOR_MODE: disabled/);
    assert.match(block, /AWS_INVENTORY_SCANNER_MODE: disabled/);
    assert.match(block, /AWS_CHANGE_EXECUTION_MODE: disabled/);
  }
});

test("public-demo worker receives only worker startup configuration", () => {
  const worker = serviceBlock("worker");

  assert.match(worker, /NODE_ENV: "\$\{PUBLIC_DEMO_NODE_ENV:-development\}"/);
  assert.match(worker, /DATABASE_URL:/);
  assert.match(worker, /REDIS_HOST: redis/);
  assert.match(worker, /REDIS_PORT: 6379/);
  assert.doesNotMatch(worker, /JWT_SECRET/);
  assert.doesNotMatch(worker, /CSRF_HMAC_KEY/);
  assert.doesNotMatch(worker, /AUTH_COOKIE_SECURE/);
  assert.doesNotMatch(worker, /TRUST_PROXY/);
  assert.doesNotMatch(worker, /FRONTEND_URL/);
});

test("public-demo compose does not commit fallback auth secrets", () => {
  assert.doesNotMatch(publicDemoCompose, /cloudshield-local-demo-jwt-secret-change-me/);
  assert.doesNotMatch(publicDemoCompose, /cloudshield-local-demo-csrf-hmac-key-change-me/);
  assert.doesNotMatch(publicDemoCompose, /replace_with_a_long_random_public_demo/);
});

test("public-demo compose renders with strong synthetic values and restores process environment", () => {
  const beforeJwtSecret = process.env.JWT_SECRET;
  const beforeCsrfHmacKey = process.env.CSRF_HMAC_KEY;
  const rendered = renderCompose();
  assert.equal(process.env.JWT_SECRET, beforeJwtSecret);
  assert.equal(process.env.CSRF_HMAC_KEY, beforeCsrfHmacKey);

  const backend = requireService(rendered, "backend");
  const backendEnv = backend.environment;
  assertEnvPresent(backendEnv, "JWT_SECRET");
  assertEnvPresent(backendEnv, "CSRF_HMAC_KEY");
  assert.equal(backendEnv?.NODE_ENV, "development");
  assert.equal(backendEnv?.AUTH_COOKIE_SECURE, "false");
  assert.equal(backendEnv?.TRUST_PROXY, "false");
  assert.equal(backendEnv?.FRONTEND_URL, "http://localhost:3100");
  assert.equal(backendEnv?.PUBLIC_FRONTEND_ORIGIN, "http://localhost:3100");
  assert.equal(backendEnv?.AWS_CONNECTOR_MODE, "disabled");
  assert.equal(backendEnv?.AWS_INVENTORY_SCANNER_MODE, "disabled");
  assert.equal(backendEnv?.AWS_CHANGE_EXECUTION_MODE, "disabled");
  assert.equal(backend.ports?.[0]?.published, "4100");

  const worker = requireService(rendered, "worker");
  const workerEnv = worker.environment;
  assert.equal(workerEnv?.NODE_ENV, "development");
  assertEnvAbsent(workerEnv, "JWT_SECRET");
  assertEnvAbsent(workerEnv, "CSRF_HMAC_KEY");
  assert.equal(workerEnv?.AWS_CONNECTOR_MODE, "disabled");
  assert.equal(workerEnv?.AWS_INVENTORY_SCANNER_MODE, "disabled");
  assert.equal(workerEnv?.AWS_CHANGE_EXECUTION_MODE, "disabled");

  const frontend = requireService(rendered, "frontend");
  const frontendEnv = frontend.environment;
  assert.equal(frontendEnv?.NEXT_PUBLIC_API_BASE_URL, "http://localhost:4100");
  assert.equal(frontendEnv?.BACKEND_INTERNAL_URL, "http://backend:4000");
  assert.equal(frontend.ports?.[0]?.published, "3100");
});

test("public-demo compose fails closed when mandatory auth secrets are absent", () => {
  assert.throws(() => renderCompose({ JWT_SECRET: null }), /JWT_SECRET/);
  assert.throws(() => renderCompose({ CSRF_HMAC_KEY: null }), /CSRF_HMAC_KEY/);
});

test("production runtime safeguards remain strict", () => {
  assert.match(configSource, /if \(env\.NODE_ENV !== "production"\) return;/);
  assert.match(configSource, /AUTH_COOKIE_SECURE must be true in production/);
  assert.match(configSource, /must be an exact https origin and must not be localhost/);
  assert.match(configSource, /must not use a development, demo, or placeholder value in production/);
});
