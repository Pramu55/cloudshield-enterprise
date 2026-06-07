export type GlobalSearchEntityType =
  | "awsAccount"
  | "resource"
  | "finding"
  | "complianceControl"
  | "governance"
  | "recommendation"
  | "scanRun"
  | "operation"
  | "report"
  | "auditEvent"
  | "evidence"
  | "team"
  | "member"
  | "invitation"
  | "alias"
  | "navigation";

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchEntityType;
  title: string;
  subtitle?: string;
  status?: string;
  severity?: string;
  href: string;
  updatedAt?: string;
  metadata?: Record<string, string>;
};

export type GlobalSearchGroup = {
  type: GlobalSearchEntityType;
  label: string;
  results: GlobalSearchResult[];
  hasMore: boolean;
};

export type GlobalSearchResponse = {
  query: string;
  groups: GlobalSearchGroup[];
  total: number;
  generatedAt: string;
};

export type GlobalSearchQuery = {
  q?: string;
  types?: GlobalSearchEntityType[];
  limit?: number;
};
