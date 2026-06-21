import { z } from "zod";
import type { Prisma } from "@prisma/client";

const MAX_JSON_BYTES = 8 * 1024;
const MAX_DEPTH = 6;
const MAX_NODES = 200;
const MAX_COLLECTION_ITEMS = 50;
const MAX_STRING_LENGTH = 2000;
const unsafeKeyPattern =
  /credential|secret|access.?key|token|authorization|password|private.?key|provider.?error|raw.?response|stack/i;
const unsafeTextPattern =
  /secretaccesskey|accesskeyid|authorization:\s*bearer|provider\s*error|providererror|raw\s*provider|-----begin .*private key-----/i;
const stackTracePattern = /\bat\s+[\w.$<>]+\s*\([^)\r\n]+:\d+:\d+\)/i;
const controlCharacterPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const safeText = (maxLength: number) =>
  z.string().min(1).max(maxLength).superRefine((value, context) => {
    if (
      controlCharacterPattern.test(value) ||
      unsafeTextPattern.test(value) ||
      stackTracePattern.test(value)
    ) {
      context.addIssue({ code: "custom", message: "Evidence text contains unsafe content." });
    }
  });

const createInputSchema = z.object({
  organizationId: z.string().min(1).max(128),
  securityFindingId: z.string().min(1).max(128),
  resourceId: z.string().min(1).max(128).nullable(),
  ruleId: z.string().min(1).max(160),
  ruleVersion: z.string().min(1).max(40),
  schemaVersion: z.number().int().positive().default(1),
  evaluationMode: z.literal("STORED_INVENTORY"),
  findingSource: z.literal("RULE_ENGINE"),
  resourceSource: z.enum(["SAMPLE", "AWS_SYNC", "MANUAL", "RULE_ENGINE", "IMPORT", "SYSTEM"]).nullable(),
  sampleData: z.boolean(),
  title: safeText(500),
  summary: safeText(2000),
  resourceSnapshot: z.record(z.string(), z.unknown()),
  evaluationContext: z.record(z.string(), z.unknown()),
  correlationId: z.string().uuid().nullable(),
  capturedAt: z.date()
}).strict().superRefine((value, context) => {
  if (value.sampleData !== (value.resourceSource === "SAMPLE")) {
    context.addIssue({
      code: "custom",
      path: ["sampleData"],
      message: "Sample data must match resource provenance."
    });
  }
});

export class EvidenceSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceSnapshotValidationError";
  }
}

type SafeJson = null | boolean | number | string | SafeJson[] | { [key: string]: SafeJson };

export function sanitizeEvidenceSnapshotJson(value: unknown): Prisma.InputJsonValue {
  let nodeCount = 0;

  function visit(input: unknown, depth: number): SafeJson {
    nodeCount++;
    if (nodeCount > MAX_NODES) {
      throw new EvidenceSnapshotValidationError("Evidence snapshot exceeds the node limit.");
    }
    if (depth > MAX_DEPTH) {
      throw new EvidenceSnapshotValidationError("Evidence snapshot exceeds the depth limit.");
    }
    if (input === null || typeof input === "boolean") return input;
    if (typeof input === "number") {
      if (!Number.isFinite(input)) {
        throw new EvidenceSnapshotValidationError("Evidence snapshot contains a non-finite number.");
      }
      return input;
    }
    if (typeof input === "string") {
      if (
        input.length > MAX_STRING_LENGTH ||
        controlCharacterPattern.test(input) ||
        unsafeTextPattern.test(input) ||
        stackTracePattern.test(input)
      ) {
        throw new EvidenceSnapshotValidationError("Evidence snapshot contains unsafe text.");
      }
      return input;
    }
    if (Array.isArray(input)) {
      if (input.length > MAX_COLLECTION_ITEMS) {
        throw new EvidenceSnapshotValidationError("Evidence snapshot array is too large.");
      }
      return input.map((item) => visit(item, depth + 1));
    }
    if (typeof input === "object") {
      const entries = Object.entries(input as Record<string, unknown>);
      if (entries.length > MAX_COLLECTION_ITEMS) {
        throw new EvidenceSnapshotValidationError("Evidence snapshot object is too large.");
      }
      const output: Record<string, SafeJson> = {};
      for (const [key, item] of entries) {
        if (unsafeKeyPattern.test(key) || controlCharacterPattern.test(key)) {
          throw new EvidenceSnapshotValidationError("Evidence snapshot contains an unsafe field.");
        }
        output[key] = visit(item, depth + 1);
      }
      return output;
    }
    throw new EvidenceSnapshotValidationError("Evidence snapshot contains an unsupported value.");
  }

  const sanitized = visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(sanitized), "utf8") > MAX_JSON_BYTES) {
    throw new EvidenceSnapshotValidationError("Evidence snapshot exceeds the 8KB limit.");
  }
  return sanitized as Prisma.InputJsonValue;
}

export async function appendSecurityFindingEvidenceSnapshot(
  tx: Prisma.TransactionClient,
  rawInput: unknown
) {
  const correlationId =
    rawInput && typeof rawInput === "object" && "correlationId" in rawInput
      ? String((rawInput as { correlationId?: unknown }).correlationId ?? "") || null
      : null;

  try {
    const input = createInputSchema.parse(rawInput);
    const resourceSnapshot = sanitizeEvidenceSnapshotJson(input.resourceSnapshot);
    const evaluationContext = sanitizeEvidenceSnapshotJson(input.evaluationContext);
    if (
      Buffer.byteLength(
        JSON.stringify({ resourceSnapshot, evaluationContext }),
        "utf8"
      ) > MAX_JSON_BYTES
    ) {
      throw new EvidenceSnapshotValidationError("Evidence snapshot exceeds the 8KB limit.");
    }
    return await tx.securityFindingEvidenceSnapshot.create({
      data: { ...input, resourceSnapshot, evaluationContext }
    });
  } catch (error) {
    console.warn("Evidence snapshot persistence rejected.", { correlationId });
    if (error instanceof EvidenceSnapshotValidationError) throw error;
    if (error instanceof z.ZodError) {
      throw new EvidenceSnapshotValidationError("Evidence snapshot input is invalid.");
    }
    throw error;
  }
}
