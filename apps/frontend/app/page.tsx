import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Cloud,
  Database,
  FileCheck2,
  GitPullRequestDraft,
  Network,
  Search,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { PLATFORM_TITLE } from "@cloudshield/contracts";

const capabilities = [
  {
    title: "Account registry",
    description: "Tenant-scoped account records, ownership, environment, criticality, and connector readiness.",
    icon: Cloud
  },
  {
    title: "Resource inventory",
    description: "Stored DB resource views with account, region, type, posture, evidence, and relationship context.",
    icon: Database
  },
  {
    title: "Risk graph",
    description: "Relationship summaries for accounts, networks, compute, findings, plans, approvals, and evidence.",
    icon: Network
  },
  {
    title: "Security findings",
    description: "Prioritized posture findings with severity, owner workflows, evidence, and governed next actions.",
    icon: ShieldAlert
  },
  {
    title: "Compliance evidence",
    description: "CIS-inspired and SOC2-inspired internal evidence review without certification claims.",
    icon: FileCheck2
  },
  {
    title: "Reports and governance",
    description: "Internal report previews, approvals, audit stream, and manual remediation completion tracking.",
    icon: ClipboardList
  }
];

const workflow = [
  "Create workspace",
  "Review account readiness",
  "Connect read-only credentials only when configured",
  "Inspect inventory, findings, graph, and reports",
  "Plan remediation with approval and manual completion"
];

export default function LandingPage() {
  return (
    <main className="aws-marketing-page">
      <header className="aws-public-topbar">
        <Link className="aws-public-brand" href="/">
          <span><ShieldCheck size={18} /></span>
          <strong>CloudShield</strong>
        </Link>
        <nav aria-label="Primary navigation">
          <a href="#capabilities">Capabilities</a>
          <a href="#workflow">Workflow</a>
          <a href="#safety">Safety</a>
          <Link href="/register">Create workspace</Link>
          <Link className="aws-primary-link" href="/login">
            Open Console
            <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      <section className="aws-public-hero">
        <div className="aws-public-hero-copy">
          <span className="aws-kicker">
            <ShieldCheck size={14} />
            Local workspace mode
          </span>
          <h1>{PLATFORM_TITLE}</h1>
          <p>
            An original enterprise command center for account
            readiness, read-only inventory posture, security findings, compliance evidence,
            reports, and governed remediation planning.
          </p>
          <div className="aws-hero-actions">
            <Link className="aws-cta-primary" href="/login">
              Open Console
              <ArrowRight size={16} />
            </Link>
            <Link className="aws-cta-secondary" href="/register">
              Create Workspace
            </Link>
          </div>
          <div className="aws-trust-row">
            <span><CheckCircle2 size={14} /> No credential storage</span>
            <span><CheckCircle2 size={14} /> No mutation</span>
            <span><CheckCircle2 size={14} /> No Terraform apply</span>
          </div>
        </div>

        <aside className="aws-console-mock" aria-label="CloudShield console preview">
          <div className="aws-console-mock-top">
            <strong>CloudShield Command Center</strong>
            <span>Workspace</span>
          </div>
          <div className="aws-console-mock-body">
            <div className="aws-console-mock-nav">
              {["Overview", "Accounts", "Inventory", "Security", "Reports"].map((item, index) => (
                <span data-active={index === 1} key={item}>{item}</span>
              ))}
            </div>
            <div className="aws-console-mock-main">
              <label>
                <Search size={14} />
                <span>Search accounts, controls, resources</span>
              </label>
              <div className="aws-mock-header">
                <small>Account registry</small>
                <strong>Read-only readiness center</strong>
                <p>Safety gates remain visible before any explicit validation or sync action.</p>
              </div>
              <div className="aws-mock-metrics">
                {[
                  ["6", "Accounts"],
                  ["18", "Resources"],
                  ["0", "Mutations"]
                ].map(([value, label]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="aws-public-section" id="capabilities">
        <div className="aws-section-heading">
          <span>Capabilities</span>
          <h2>Enterprise cloud governance workflows, designed for CloudShield.</h2>
          <p>Compact navigation, clear statuses, crisp tables, evidence panels, and safety banners across every major module.</p>
        </div>
        <div className="aws-capability-grid">
          {capabilities.map((capability) => {
            const Icon = capability.icon;
            return (
              <article className="aws-capability-card" key={capability.title}>
                <span><Icon size={20} /></span>
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="aws-public-section" id="workflow">
        <div className="aws-workflow-panel">
          <div className="aws-section-heading">
            <span>Workflow</span>
            <h2>Safe read-only posture review from workspace to evidence.</h2>
          </div>
          <div className="aws-workflow-list">
            {workflow.map((step, index) => (
              <div className="aws-workflow-step" key={step}>
                <strong>{index + 1}</strong>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="aws-public-section" id="safety">
        <div className="aws-safety-panel">
          <div>
            <span className="aws-kicker">
              <ShieldAlert size={14} />
              Safety boundary
            </span>
            <h2>CloudShield does not run cloud actions from public or auth pages.</h2>
            <p>
              Landing, login, and registration do not run AWS validation, inventory sync,
              AWS APIs, mutation, Terraform apply, or automatic remediation.
            </p>
          </div>
          <div className="aws-safety-list">
            {[
              "No AWS logos, screenshots, assets, or certification claims",
              "No external fonts, images, or CDN assets",
              "Credential-ready model remains explicit and gated",
              "Safety labels stay visible in console workflows"
            ].map((item) => (
              <span key={item}><CheckCircle2 size={15} />{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="aws-final-cta">
        <BarChart3 size={24} />
        <h2>Open the CloudShield console</h2>
        <p>Review posture, evidence, reports, and governed remediation planning in a stable local workspace.</p>
        <div>
          <Link className="aws-cta-primary" href="/login">Open Console</Link>
          <Link className="aws-cta-secondary" href="/register">Create Workspace</Link>
        </div>
      </section>
    </main>
  );
}
