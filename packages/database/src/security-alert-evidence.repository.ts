import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { z } from "zod";

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const NO_CTRL_REGEX = /^[^\u0000-\u001F\u007F]*$/;

export const InternalSecurityAlertEvidenceCreationSchema = z.object({
  organizationId: z.string().trim().min(1).max(255).regex(ID_REGEX),
  securityAlertId: z.string().trim().min(1).max(255).regex(ID_REGEX),
  monitoringRunId: z.string().trim().min(1).max(255).regex(ID_REGEX),
  evidenceType: z.enum([
    "ACCOUNT_CONNECTIVITY",
    "INVENTORY_FRESHNESS",
    "SECURITY_FINDING",
    "PUBLIC_EXPOSURE",
    "SCAN_RUN",
    "FINDING_INCREASE",
    "COMPLIANCE_REGRESSION"
  ]),
  sourceType: z.string().trim().min(1).max(100).regex(NO_CTRL_REGEX),
  sourceId: z.string().trim().min(1).max(255).regex(NO_CTRL_REGEX).nullable(),
  title: z.string().trim().min(1).max(255).regex(NO_CTRL_REGEX),
  summary: z.string().trim().min(1).max(1000).regex(NO_CTRL_REGEX),
  observedAt: z.date().refine((d: Date) => !isNaN(d.getTime()), { message: "Invalid Date" }),
  correlationId: z.string().uuid().nullable()
}).strict();

export type InternalSecurityAlertEvidenceCreationInput = z.infer<
  typeof InternalSecurityAlertEvidenceCreationSchema
>;

export function buildSecurityAlertEvidenceDedupeKeyV1(
  input: InternalSecurityAlertEvidenceCreationInput
): string {
  const parts = [
    "v1",
    input.organizationId,
    input.securityAlertId,
    input.monitoringRunId,
    input.evidenceType,
    input.sourceType,
    input.sourceId ?? "null",
    input.title,
    input.summary
  ];

  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part + "\x00");
  }

  return hash.digest("hex");
}

type TxClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function appendSecurityAlertEvidence(
  tx: TxClient,
  rawInput: unknown
) {
  const parsed = InternalSecurityAlertEvidenceCreationSchema.parse(rawInput);

  const dedupeKey = buildSecurityAlertEvidenceDedupeKeyV1(parsed);

  return tx.securityAlertEvidence.upsert({
    where: {
      organizationId_dedupeKey: {
        organizationId: parsed.organizationId,
        dedupeKey
      }
    },
    create: {
      organizationId: parsed.organizationId,
      securityAlertId: parsed.securityAlertId,
      monitoringRunId: parsed.monitoringRunId,
      evidenceType: parsed.evidenceType,
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      title: parsed.title,
      summary: parsed.summary,
      observedAt: parsed.observedAt,
      correlationId: parsed.correlationId,
      dedupeKey,
      schemaVersion: 1
    },
    update: {}
  });
}
