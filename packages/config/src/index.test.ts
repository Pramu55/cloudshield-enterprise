import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_DEMO_CSRF_HMAC_KEY,
  LOCAL_DEMO_JWT_SECRET,
  loadRuntimeEnv,
  resolveFrontendOrigin
} from "./index.js";

const productionBase = {
  NODE_ENV: "production",
  JWT_SECRET: "prod-jwt-secret-with-at-least-thirty-two-characters",
  CSRF_HMAC_KEY: "prod-csrf-secret-with-at-least-thirty-two-characters",
  AUTH_COOKIE_SECURE: "true",
  FRONTEND_URL: "https://cloudshield.example.com"
};

test("production runtime rejects missing JWT_SECRET", () => {
  assert.throws(
    () => loadRuntimeEnv({ ...productionBase, JWT_SECRET: undefined }),
    /JWT_SECRET is required in production/
  );
});

test("production runtime rejects missing CSRF_HMAC_KEY", () => {
  assert.throws(
    () => loadRuntimeEnv({ ...productionBase, CSRF_HMAC_KEY: undefined }),
    /CSRF_HMAC_KEY is required in production/
  );
});

test("production runtime rejects known development fallback secrets", () => {
  assert.throws(
    () => loadRuntimeEnv({ ...productionBase, JWT_SECRET: LOCAL_DEMO_JWT_SECRET }),
    /JWT_SECRET must not use a development, demo, or placeholder value/
  );
  assert.throws(
    () => loadRuntimeEnv({ ...productionBase, CSRF_HMAC_KEY: LOCAL_DEMO_CSRF_HMAC_KEY }),
    /CSRF_HMAC_KEY must not use a development, demo, or placeholder value/
  );
});

test("production runtime rejects insecure cookies and localhost CORS origins", () => {
  assert.throws(
    () => loadRuntimeEnv({ ...productionBase, AUTH_COOKIE_SECURE: "false" }),
    /AUTH_COOKIE_SECURE must be true in production/
  );
  assert.throws(
    () => loadRuntimeEnv({ ...productionBase, FRONTEND_URL: "http://localhost:3100" }),
    /FRONTEND_URL or PUBLIC_FRONTEND_ORIGIN must be an exact https origin/
  );
});

test("production runtime accepts exact https PUBLIC_FRONTEND_ORIGIN", () => {
  const env = loadRuntimeEnv({
    ...productionBase,
    FRONTEND_URL: "",
    PUBLIC_FRONTEND_ORIGIN: "https://demo.cloudshield.example.com"
  });
  assert.equal(resolveFrontendOrigin(env), "https://demo.cloudshield.example.com");
});

test("development and test may use intentional local defaults", () => {
  const development = loadRuntimeEnv({ NODE_ENV: "development" });
  assert.equal(development.JWT_SECRET, LOCAL_DEMO_JWT_SECRET);
  assert.equal(development.CSRF_HMAC_KEY, LOCAL_DEMO_CSRF_HMAC_KEY);

  const testEnv = loadRuntimeEnv({ NODE_ENV: "test" });
  assert.equal(testEnv.JWT_SECRET, LOCAL_DEMO_JWT_SECRET);
  assert.equal(testEnv.CSRF_HMAC_KEY, LOCAL_DEMO_CSRF_HMAC_KEY);
});
