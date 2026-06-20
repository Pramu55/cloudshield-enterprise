import type { CurrentUserCapabilityKey } from "@cloudshield/contracts";

export type RouteCategory = "Overview" | "Cloud" | "Security" | "Operations" | "Administration";

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
    label: "Dashboard",
    href: "/dashboard",
    icon: "overview",
    category: "Overview",
    description: "Unified security and posture overview.",
    keywords: ["posture", "overview", "home", "main"]
  },
  {
    id: "nav-accounts",
    label: "Accounts",
    href: "/dashboard/accounts",
    icon: "accounts",
    category: "Cloud",
    description: "AWS accounts and connection status.",
    keywords: ["aws accounts", "cloud accounts", "connections", "onboarding"]
  },
  {
    id: "nav-inventory",
    label: "Inventory",
    href: "/dashboard/inventory",
    icon: "inventory",
    category: "Cloud",
    description: "Cloud resource inventory.",
    keywords: ["resources", "assets", "cloud resources"]
  },
  {
    id: "nav-graph",
    label: "Resource graph",
    href: "/dashboard/graph",
    icon: "graph",
    category: "Cloud",
    description: "Visual resource relationships.",
    keywords: ["resources", "topology", "architecture"]
  },
  {
    id: "nav-cost",
    label: "Cost",
    href: "/dashboard/cost",
    icon: "cost",
    category: "Cloud",
    description: "Cloud cost analysis.",
    keywords: ["spend", "billing", "finops"]
  },
  {
    id: "nav-security",
    label: "Findings",
    href: "/dashboard/security",
    icon: "security",
    category: "Security",
    description: "Security posture and alerts.",
    keywords: ["security", "posture", "alerts", "vulnerabilities"]
  },
  {
    id: "nav-security-monitoring",
    label: "Security Monitoring",
    href: "/dashboard/monitoring",
    icon: "activity",
    category: "Security",
    description: "Continuous AWS security monitoring and alerting.",
    keywords: ["monitoring", "security monitoring", "alerts", "critical alerts", "drift", "stale inventory", "monitoring health"]
  },
  {
    id: "nav-governance",
    label: "Governance",
    href: "/dashboard/governance",
    icon: "governance",
    category: "Security",
    description: "Security governance and policies.",
    keywords: ["security", "policies", "remediation", "workflows"]
  },
  {
    id: "nav-compliance",
    label: "Compliance",
    href: "/dashboard/compliance",
    icon: "compliance",
    category: "Security",
    description: "Compliance frameworks and evidence.",
    keywords: ["security", "evidence", "frameworks", "audit", "posture"]
  },
  {
    id: "nav-recommendations",
    label: "Recommendations",
    href: "/dashboard/recommendations",
    icon: "recommendations",
    category: "Security",
    description: "Security and cost recommendations.",
    keywords: ["security", "remediation", "advisor", "improvements"]
  },
  {
    id: "nav-automation",
    label: "Automation",
    href: "/dashboard/automation",
    icon: "automation",
    category: "Operations",
    description: "Automated remediation and operations.",
    keywords: ["operations", "remediation", "playbooks", "autoops"]
  },
  {
    id: "nav-scans",
    label: "Scans",
    href: "/dashboard/scans",
    icon: "scans",
    category: "Operations",
    description: "Inventory and security scan history.",
    keywords: ["operations", "scan history", "jobs", "sync"]
  },
  {
    id: "nav-reports",
    label: "Reports",
    href: "/dashboard/reports",
    icon: "reports",
    category: "Operations",
    description: "Generated reports and exports.",
    keywords: ["operations", "evidence", "exports", "downloads"]
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
  { label: "Cloud", items: ROUTE_REGISTRY.filter(r => r.category === "Cloud") },
  { label: "Security", items: ROUTE_REGISTRY.filter(r => r.category === "Security") },
  { label: "Operations", items: ROUTE_REGISTRY.filter(r => r.category === "Operations") },
  { label: "Administration", items: ROUTE_REGISTRY.filter(r => r.category === "Administration") }
];
