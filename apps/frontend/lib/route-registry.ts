import type { CurrentUserCapabilityKey } from "@cloudshield/contracts";

export type RouteCategory =
  | "Overview"
  | "Cloud Governance"
  | "Security"
  | "Compliance"
  | "Operations"
  | "Administration";

export interface RouteMetadata {
  id: string;
  label: string;
  href: string;
  icon: string;
  category: RouteCategory;
  // Capability visibility is UX-only and never grants endpoint authority.
  requiredCapability?: CurrentUserCapabilityKey;
  description?: string;
  keywords: string[];
}

export const ROUTE_REGISTRY: RouteMetadata[] = [
  {
    id: "nav-dashboard",
    label: "Executive dashboard",
    href: "/dashboard",
    icon: "overview",
    category: "Overview",
    description: "CloudShield console home for posture, evidence, and runtime safety.",
    keywords: ["posture", "overview", "home", "main", "console", "command center"]
  },
  {
    id: "nav-accounts",
    label: "Accounts",
    href: "/dashboard/accounts",
    icon: "accounts",
    category: "Cloud Governance",
    description: "AWS accounts, connection status, validation, and onboarding.",
    keywords: ["aws accounts", "cloud accounts", "connections", "onboarding", "sts"]
  },
  {
    id: "nav-inventory",
    label: "Inventory explorer",
    href: "/dashboard/inventory",
    icon: "inventory",
    category: "Cloud Governance",
    description: "Resource explorer for AWS_SYNC and sample cloud assets.",
    keywords: ["resources", "assets", "cloud resources", "aws sync", "explorer"]
  },
  {
    id: "nav-graph",
    label: "Resource graph",
    href: "/dashboard/graph",
    icon: "graph",
    category: "Cloud Governance",
    description: "Visual resource relationships.",
    keywords: ["resources", "topology", "architecture"]
  },
  {
    id: "nav-cost",
    label: "Cost",
    href: "/dashboard/cost",
    icon: "cost",
    category: "Cloud Governance",
    description: "Cloud cost analysis.",
    keywords: ["spend", "billing", "finops"]
  },
  {
    id: "nav-security",
    label: "Security findings",
    href: "/dashboard/security",
    icon: "security",
    category: "Security",
    description: "Findings, affected resources, evidence, and workflow status.",
    keywords: ["security", "posture", "alerts", "vulnerabilities", "findings"]
  },
  {
    id: "nav-security-monitoring",
    label: "Monitoring",
    href: "/dashboard/monitoring",
    icon: "activity",
    category: "Operations",
    description: "Continuous AWS security monitoring and alerting.",
    keywords: ["monitoring", "security monitoring", "alerts", "critical alerts", "drift", "stale inventory", "monitoring health"]
  },
  {
    id: "nav-governance",
    label: "Governance",
    href: "/dashboard/governance",
    icon: "governance",
    category: "Security",
    description: "Review-only governance workflows, approvals, and risk decisions.",
    keywords: ["security", "policies", "review", "workflows"]
  },
  {
    id: "nav-risk-acceptances",
    label: "Risk Acceptances",
    href: "/dashboard/risk-acceptances",
    icon: "governance",
    category: "Security",
    requiredCapability: "risks.read",
    description: "Accepted risk governance, expiry, and evidence linkage.",
    keywords: ["risk acceptance", "accepted risks", "exceptions", "expiry", "governance"]
  },
  {
    id: "nav-compliance",
    label: "Compliance",
    href: "/dashboard/compliance",
    icon: "compliance",
    category: "Compliance",
    requiredCapability: "reports.read",
    description: "Evidence-backed internal control mapping; readiness, not certification.",
    keywords: ["security", "evidence", "controls", "audit", "posture", "cis inspired", "soc2 inspired"]
  },
  {
    id: "nav-recommendations",
    label: "Recommendations",
    href: "/dashboard/recommendations",
    icon: "recommendations",
    category: "Security",
    description: "Advisory security and cost recommendations for human review.",
    keywords: ["security", "advisor", "improvements", "review only"]
  },
  {
    id: "nav-automation",
    label: "Automation",
    href: "/dashboard/automation",
    icon: "automation",
    category: "Operations",
    description: "Advisory assessment automation and evidence generation; execution disabled.",
    keywords: ["operations", "assessment", "playbooks", "advisory", "evidence"]
  },
  {
    id: "nav-scans",
    label: "Scans",
    href: "/dashboard/scans",
    icon: "scans",
    category: "Cloud Governance",
    description: "Inventory and security scan history.",
    keywords: ["operations", "scan history", "jobs", "sync"]
  },
  {
    id: "nav-reports",
    label: "Reports",
    href: "/dashboard/reports",
    icon: "reports",
    category: "Compliance",
    description: "DB-only reports, governance proof, and evidence exports.",
    keywords: ["operations", "evidence", "exports", "downloads", "governance proof"]
  },
  {
    id: "nav-settings",
    label: "Settings",
    href: "/dashboard/settings",
    icon: "settings",
    category: "Administration",
    requiredCapability: "settings.read",
    description: "Workspace and organization settings.",
    keywords: ["workspace", "organization", "preferences", "billing"]
  },
  {
    id: "nav-members",
    label: "Members",
    href: "/dashboard/settings/members",
    icon: "members",
    category: "Administration",
    requiredCapability: "members.read",
    description: "Manage team members and access.",
    keywords: ["team", "users", "access", "rbac", "roles"]
  },
  {
    id: "nav-profile",
    label: "Profile",
    href: "/dashboard/profile",
    icon: "profile",
    category: "Administration",
    description: "Personal details, security context, and workspace access.",
    keywords: ["profile", "personal", "account", "identity", "security"]
  }
];

export const NAV_GROUPS: Array<{ label: RouteCategory; items: RouteMetadata[] }> = [
  { label: "Overview", items: ROUTE_REGISTRY.filter(r => r.category === "Overview") },
  { label: "Cloud Governance", items: ROUTE_REGISTRY.filter(r => r.category === "Cloud Governance") },
  { label: "Security", items: ROUTE_REGISTRY.filter(r => r.category === "Security") },
  { label: "Compliance", items: ROUTE_REGISTRY.filter(r => r.category === "Compliance") },
  { label: "Operations", items: ROUTE_REGISTRY.filter(r => r.category === "Operations") },
  { label: "Administration", items: ROUTE_REGISTRY.filter(r => r.category === "Administration") }
];
