import { REMEDIATION_BLOCKED_REASON } from "@cloudshield/contracts";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const READ_ONLY_SAFETY_MODE = "read_only" as const;

export function recommendationExecutionPolicy() {
  return {
    canExecute: false as const,
    blockedReason: REMEDIATION_BLOCKED_REASON
  };
}

export function assertReadOnlyOperation(operation: string): void {
  if (!operation.startsWith("read:")) {
    throw new Error("CloudShield v1 only permits read-only foundation operations.");
  }
}

const JwtPayloadSchema = z.object({
  sub: z.string(),
  organizationId: z.string(),
  email: z.email(),
  role: z.string(),
  exp: z.number()
});

export type CloudShieldJwtPayload = z.infer<typeof JwtPayloadSchema>;

export function signAccessToken(
  payload: Omit<CloudShieldJwtPayload, "exp">,
  secret: string,
  expiresInSeconds = 60 * 60
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const body: CloudShieldJwtPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signature = createSignature(`${encodedHeader}.${encodedBody}`, secret);

  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export function verifyAccessToken(token: string, secret: string): CloudShieldJwtPayload {
  const [encodedHeader, encodedBody, signature] = token.split(".");

  if (!encodedHeader || !encodedBody || !signature) {
    throw new Error("Invalid token format.");
  }

  const expectedSignature = createSignature(`${encodedHeader}.${encodedBody}`, secret);

  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new Error("Invalid token signature.");
  }

  const payload = JwtPayloadSchema.parse(
    JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8"))
  );

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired.");
  }

  return payload;
}

function createSignature(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
