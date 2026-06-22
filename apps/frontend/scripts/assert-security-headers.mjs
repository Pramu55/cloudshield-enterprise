import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, "..");

// 1. helper to get a dynamic free port
function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

// 2. helper to poll endpoint for readiness
async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200 || res.status === 307 || res.status === 302) {
        return;
      }
    } catch {
      // Ignored: wait for next poll
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms.`);
}

async function main() {
  const buildManifestPath = path.resolve(frontendDir, ".next/build-manifest.json");
  if (!fs.existsSync(buildManifestPath)) {
    throw new Error("Frontend build artifacts are missing. Run `pnpm --filter @cloudshield/frontend build` first.");
  }

  // The build is a separate CI step. This assertion only starts the verified
  // artifact, avoiding duplicate builds and lock-related release timeouts.
  const nextBin = path.resolve(frontendDir, "node_modules/next/dist/bin/next");
  if (!fs.existsSync(nextBin)) {
    console.error(`Next.js executable not found at ${nextBin}`);
    process.exit(1);
  }

  // 3. Find a dynamic port
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Starting Next.js production server on ${baseUrl}`);

  // 4. Spawn the Next.js process (binding only to 127.0.0.1 / localhost)
  const child = spawn("node", [nextBin, "start", "--port", String(port), "--hostname", "127.0.0.1"], {
    cwd: frontendDir,
    env: { ...process.env, PORT: String(port), NODE_ENV: "production" }
  });

  let exited = false;
  child.on("exit", (code) => {
    exited = true;
    console.log(`Next.js process exited with code ${code}`);
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[Next.js stdout] ${chunk.toString().trim()}\n`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[Next.js stderr] ${chunk.toString().trim()}\n`);
  });

  try {
    // 5. Wait for server readiness
    await waitForServer(baseUrl);
    console.log("Next.js server is ready. Verifying headers...");

    const expectedHeaders = {
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "cross-origin-opener-policy": "same-origin",
      "x-dns-prefetch-control": "off"
    };

    const verifyHeaders = (res, urlLabel) => {
      // Assert that none of the forbidden headers are returned
      const forbidden = ["content-security-policy", "content-security-policy-report-only", "cross-origin-resource-policy", "x-xss-protection"];
      for (const header of forbidden) {
        if (res.headers.has(header)) {
          throw new Error(`[FAIL] ${urlLabel} returned forbidden header: ${header}`);
        }
      }

      // Verify each expected header
      for (const [key, expectedValue] of Object.entries(expectedHeaders)) {
        const value = res.headers.get(key);
        if (value !== expectedValue) {
          throw new Error(`[FAIL] ${urlLabel} expected header '${key}' to be '${expectedValue}', got '${value}'`);
        }
      }
      console.log(`[PASS] ${urlLabel} security headers verified successfully.`);
    };

    // A. Verify root "/" page
    console.log("Fetching / ...");
    const rootRes = await fetch(`${baseUrl}/`, { redirect: "manual" });
    if (rootRes.status !== 200) {
      throw new Error(`Expected status 200 for /, got ${rootRes.status}`);
    }
    verifyHeaders(rootRes, "/");

    // B. Verify "/login" page
    console.log("Fetching /login ...");
    const loginRes = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    if (loginRes.status !== 200) {
      throw new Error(`Expected status 200 for /login, got ${loginRes.status}`);
    }
    verifyHeaders(loginRes, "/login");

    // C. Verify "/dashboard" redirect behavior
    console.log("Fetching /dashboard ...");
    const dashboardRes = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });

    // Check if it is a redirect
    if (dashboardRes.status === 302 || dashboardRes.status === 307) {
      const location = dashboardRes.headers.get("location");
      console.log(`[INFO] /dashboard returned redirect status ${dashboardRes.status} to: ${location}`);
      if (!location) {
        throw new Error("Redirect response is missing Location header.");
      }

      // Resolve absolute URL
      const redirectUrl = new URL(location, baseUrl);

      // Reject any external redirect location
      if (redirectUrl.hostname !== "127.0.0.1" && redirectUrl.hostname !== "localhost") {
        throw new Error(`External redirect detected: ${location}`);
      }

      verifyHeaders(dashboardRes, "/dashboard (redirect)");
    } else if (dashboardRes.status === 200) {
      console.log("[INFO] /dashboard returned 200 (client-side redirection path)");
      verifyHeaders(dashboardRes, "/dashboard (HTML)");
    } else {
      throw new Error(`Unexpected status code for /dashboard: ${dashboardRes.status}`);
    }

    // D. Verify one real static asset
    const manifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf8"));
    const mainChunks = manifest.rootMainFiles || manifest.pages["/_app"] || manifest.pages["/"] || [];
    const jsChunk = mainChunks.find((chunk) => chunk.endsWith(".js"));
    if (!jsChunk) {
      throw new Error("Could not find any main JavaScript chunk in build manifest.");
    }

    const assetUrl = `${baseUrl}/_next/${jsChunk}`;
    console.log(`Fetching static asset from ${assetUrl} ...`);
    const assetRes = await fetch(assetUrl);
    if (assetRes.status !== 200) {
      throw new Error(`Expected status 200 for static asset, got ${assetRes.status}`);
    }

    // Verify static asset headers
    const contentType = assetRes.headers.get("content-type") || "";
    if (!contentType.includes("javascript")) {
      throw new Error(`Expected content-type to include 'javascript', got '${contentType}'`);
    }
    const assetNoSniff = assetRes.headers.get("x-content-type-options");
    if (assetNoSniff !== "nosniff") {
      throw new Error(`Expected x-content-type-options: nosniff on static asset, got '${assetNoSniff}'`);
    }
    console.log("[PASS] Static asset verification succeeded.");

  } catch (error) {
    console.error("Test suite failed:", error.message);
    process.exitCode = 1;
  } finally {
    // 8. Terminate Next.js child process
    console.log("Shutting down Next.js production server...");
    if (!exited) {
      child.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!exited) {
        console.log("Next.js server did not exit gracefully, force-killing...");
        child.kill("SIGKILL");
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
