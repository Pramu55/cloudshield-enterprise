import { prisma } from "@cloudshield/database";

type AuditInput = {
  organizationId: string;
  actorUserId: string;
  findingId: string;
  action: string;
  metadata: Record<string, unknown>;
};

export async function createRiskWorkflowAuditEvent(input: AuditInput) {
  return prisma.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: "security_finding",
      targetId: input.findingId,
      metadata: sanitizeMetadata(input.metadata) as any
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
  return JSON.parse(
    JSON.stringify(metadata, (_key, value) => {
      if (typeof value !== "string") {
        return value;
      }

      if (
        /(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|aws_secret_access_key|secret_access_key|session_token)/i.test(
          value
        )
      ) {
        return "[redacted]";
      }

      return value;
    })
  ) as Record<string, unknown>;
}
