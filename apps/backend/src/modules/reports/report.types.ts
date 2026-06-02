import type { ReportMetric, ReportSection, ReportType } from "@cloudshield/contracts";

export type ReportPreviewInput = {
  reportType: ReportType;
  scope?: string;
  filters?: Record<string, unknown>;
};

export type ReportPreview = {
  reportType: ReportType;
  title: string;
  generatedAt: string;
  scope: string;
  sections: ReportSection[];
  metrics: ReportMetric[];
  message: string;
};

export type ReportSafetyFlags = {
  sampleData: true;
  sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.";
  generatedFromCloudShieldRecordsOnly: true;
  officialAuditReportClaim: false;
  officialCertificationClaim: false;
  awsApiCallExecuted: false;
  mutationExecuted: false;
  remediationExecuted: false;
};
