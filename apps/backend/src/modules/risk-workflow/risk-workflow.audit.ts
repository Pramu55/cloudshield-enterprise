import type { Prisma } from "@cloudshield/database";
import type { RiskWorkflowAuditActionName } from "./risk-workflow.types.js";

type AuditClient = Pick<Prisma.TransactionClient, "auditEvent">;

type AuditInput = {
  organizationId: string;
  actorUserId: string;
  findingId: string;
  action: RiskWorkflowAuditActionName;
  metadata: Record<string, unknown>;
};

const unsafeMetadataKey =
  /(?:access[_-]?key|secret|session[_-]?token|credential|authorization|raw[_-]?(?:response|error)|provider[_-]?error|stack)/i;
const unsafeMetadataValue =
  /(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|aws_secret_access_key|secret_access_key|session_token|raw provider|provider error|(?:^|\s)at\s+\S+\s+\([^)]+:\d+:\d+\))/i;

export async function createRiskWorkflowAuditEvent(
  client: AuditClient,
  input: AuditInput
) {
  return client.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: "security_finding",
      targetId: input.findingId,
      metadata: sanitizeMetadata(input.metadata) as Prisma.InputJsonObject
    }
  });
}

export function toRiskAuditEventDto(event: {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorUserId: string | null;
  metadata: unknown;
  createdAt: Date;
}) {
  return {
    id: event.id,
    action: event.action,
    targetType: "security_finding" as const,
    targetId: event.targetId,
    actorUserId: event.actorUserId,
    metadata: (event.metadata as Record<string, unknown>) || {},
    createdAt: event.createdAt.toISOString()
  };
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  return sanitizeValue(metadata) as Record<string, unknown>;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return unsafeMetadataValue.test(value) ? "[redacted]" : value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !unsafeMetadataKey.test(key))
        .map(([key, nestedValue]) => [key, sanitizeValue(nestedValue)])
    );
  }

  return value;
}
