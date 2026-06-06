import Link from "next/link";
import { ArrowRight, ClipboardCheck, Cloud, FileText, Network, ShieldAlert, ShieldCheck } from "lucide-react";

const capabilities = [
  {
    title: "Account registry",
    description: "Cloud account records, ownership, validation state, and connector readiness in one operator view.",
    icon: Cloud
  },
  {
    title: "Inventory console",
    description: "Resource tables, detail pages, and source labeling for records returned by CloudShield APIs.",
    icon: Network
  },
  {
    title: "Security workflow",
    description: "Finding queues, severity, ownership, and governed next actions for security review.",
    icon: ShieldAlert
  },
  {
    title: "Evidence and reports",
    description: "Compliance evidence, generated reports, and audit context for internal governance.",
    icon: FileText
  },
  {
    title: "Approval operations",
    description: "Plans, approvals, activity, and manual completion tracking for remediation work.",
    icon: ClipboardCheck
  }
];

export default function LandingPage() {
  return (
    <main className="public-page">
      <header className="public-topbar">
        <Link className="public-brand" href="/">
          <span><ShieldCheck size={18} /></span>
          <strong>CloudShield</strong>
        </Link>
        <nav aria-label="Primary navigation">
          <a href="#capabilities">Capabilities</a>
          <Link href="/register">Create workspace</Link>
          <Link className="cs-button" href="/login">Open console</Link>
        </nav>
      </header>

      <section className="public-hero">
        <div>
          <p className="public-kicker">Enterprise cloud security console</p>
          <h1>CloudShield</h1>
          <p>
            A premium operations workspace for account posture, inventory records,
            findings, evidence, reports, and governed remediation planning.
          </p>
          <div className="public-actions">
            <Link className="cs-button" href="/login">
              Open console
              <ArrowRight size={15} />
            </Link>
            <Link className="cs-button-secondary" href="/register">Create workspace</Link>
          </div>
        </div>
        <div className="console-preview" aria-label="CloudShield console preview">
          <div className="console-preview-header">
            <span className="console-preview-dot" />
            <span className="console-preview-dot" />
            <span className="console-preview-dot" />
            <strong>CloudShield console</strong>
          </div>
          <div className="console-preview-body">
            <div className="console-preview-nav">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="console-preview-main">
              <div className="preview-title" />
              <div className="preview-row" />
              <div className="preview-grid">
                <span />
                <span />
                <span />
              </div>
              <div className="preview-table">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-grid" id="capabilities">
        {capabilities.map((capability) => {
          const Icon = capability.icon;
          return (
            <article className="public-card" key={capability.title}>
              <span className="public-card-icon"><Icon size={18} /></span>
              <h2>{capability.title}</h2>
              <p>{capability.description}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
