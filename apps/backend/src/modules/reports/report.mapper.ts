import type { ReportExportDto, ReportFormat, ReportStatus, ReportType } from "@cloudshield/contracts";

type ReportExportRecord = {
  id: string;
  organizationId: string;
  reportType: string;
  reportScope: string;
  title: string | null;
  status: ReportStatus;
  format: string;
  summaryJson: unknown;
  filtersJson: unknown;
  sampleData: boolean;
  officialAuditReportClaim: boolean;
  requestedByUserId: string | null;
  generatedByUserId: string | null;
  generatedAt: Date | null;
  exportedFilePath: string | null;
  requestedBy: string | null;
  createdAt: Date;
  completedAt: Date | null;
  archivedAt: Date | null;
};

export function toReportExportDto(report: ReportExportRecord): ReportExportDto {
  return {
    id: report.id,
    organizationId: report.organizationId,
    reportType: normalizeReportType(report.reportType),
    reportScope: report.reportScope,
    title: report.title ?? report.reportType,
    status: report.status,
    format: normalizeFormat(report.format),
    summaryJson: toRecord(report.summaryJson),
    filtersJson: toRecord(report.filtersJson),
    sampleData: report.sampleData,
    officialAuditReportClaim: false,
    requestedByUserId: report.requestedByUserId,
    generatedByUserId: report.generatedByUserId,
    generatedAt: report.generatedAt?.toISOString() ?? null,
    exportedFilePath: report.exportedFilePath,
    requestedBy: report.requestedBy,
    createdAt: report.createdAt.toISOString(),
    completedAt: report.completedAt?.toISOString() ?? null,
    archivedAt: report.archivedAt?.toISOString() ?? null
  };
}

function normalizeReportType(value: string): ReportType {
  const allowed: ReportType[] = [
    "EXECUTIVE_POSTURE_SUMMARY",
    "SECURITY_FINDINGS_SUMMARY",
    "COMPLIANCE_EVIDENCE_SUMMARY",
    "RISK_WORKFLOW_SUMMARY",
    "AWS_ACCOUNT_GOVERNANCE_SUMMARY",
    "COST_GOVERNANCE_SUMMARY",
    "AUTOMATED_ASSESSMENT"
  ];

  return allowed.includes(value as ReportType)
    ? (value as ReportType)
    : "EXECUTIVE_POSTURE_SUMMARY";
}

function normalizeFormat(value: string): ReportFormat {
  return value === "json" ? "json" : "json-preview";
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
