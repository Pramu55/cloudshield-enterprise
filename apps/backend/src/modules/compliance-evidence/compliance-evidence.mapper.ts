import type {
  ComplianceControlDto,
  ComplianceEvidenceDto,
  ComplianceFramework
} from "@cloudshield/contracts";

type ControlRecord = {
  id: string;
  organizationId: string;
  controlId: string;
  framework: string;
  controlCode: string | null;
  controlTitle: string | null;
  controlDescription: string | null;
  controlObjective: string | null;
  category: string | null;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  group: string;
  title: string;
  description: string;
  status: "PASS" | "FAIL" | "WARNING" | "NEEDS_REVIEW" | "NOT_APPLICABLE" | "NOT_EVALUATED";
  evidenceCount: number;
  findingCount: number;
  failedResources: number;
  ownerTeamId: string | null;
  ownerTeam?: { name: string } | null;
  lastScanAt: Date | null;
  lastEvaluatedAt: Date | null;
};

type EvidenceRecord = {
  id: string;
  organizationId: string;
  controlId: string;
  control?: { controlId: string; controlCode: string | null } | null;
  resourceId: string | null;
  resource?: { name: string | null; resourceType: string } | null;
  status: "PASS" | "FAIL" | "WARNING" | "NEEDS_REVIEW" | "NOT_APPLICABLE" | "NOT_EVALUATED";
  evidence: unknown;
  evidenceType: string;
  source: string;
  sourceType: string;
  sourceId: string | null;
  summary: string | null;
  evidenceJson: unknown;
  sampleData: boolean;
  confidence: string;
  notes: string | null;
  collectedAt: Date;
  createdAt: Date;
};

export function toComplianceControlDto(control: ControlRecord): ComplianceControlDto {
  return {
    id: control.id,
    organizationId: control.organizationId,
    controlId: control.controlId,
    framework: normalizeFramework(control.framework),
    controlCode: control.controlCode ?? control.controlId,
    controlTitle: control.controlTitle ?? control.title,
    controlDescription: control.controlDescription ?? control.description,
    controlObjective:
      control.controlObjective ?? "Evidence is generated from CloudShield records.",
    category: control.category ?? control.group,
    severity: control.severity,
    group: control.group,
    title: control.title,
    description: control.description,
    status: control.status,
    evidenceCount: control.evidenceCount,
    findingCount: control.findingCount,
    failedResources: control.failedResources,
    ownerTeamId: control.ownerTeamId,
    ownerTeamName: control.ownerTeam?.name ?? null,
    lastScanAt: control.lastScanAt?.toISOString() ?? null,
    lastEvaluatedAt: control.lastEvaluatedAt?.toISOString() ?? null,
    sampleData: true
  };
}

export function toComplianceEvidenceDto(evidence: EvidenceRecord): ComplianceEvidenceDto {
  return {
    id: evidence.id,
    organizationId: evidence.organizationId,
    controlId: evidence.controlId,
    controlCode: evidence.control?.controlCode ?? evidence.control?.controlId ?? evidence.controlId,
    resourceId: evidence.resourceId,
    resourceName: evidence.resource?.name ?? null,
    resourceType: evidence.resource?.resourceType ?? null,
    status: evidence.status,
    evidenceType: evidence.evidenceType,
    source: evidence.source,
    sourceType: evidence.sourceType,
    sourceId: evidence.sourceId,
    summary: evidence.summary ?? "Evidence is generated from CloudShield records.",
    evidenceJson: toRecord(evidence.evidenceJson) || toRecord(evidence.evidence) || {},
    sampleData: evidence.sampleData,
    confidence: evidence.confidence,
    notes: evidence.notes,
    collectedAt: evidence.collectedAt.toISOString(),
    createdAt: evidence.createdAt.toISOString()
  };
}

function normalizeFramework(framework: string): ComplianceFramework {
  if (framework === "CIS_INSPIRED" || framework === "SOC2_INSPIRED") {
    return framework;
  }

  return "INTERNAL_GOVERNANCE";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}
