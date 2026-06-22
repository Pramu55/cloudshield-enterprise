"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-shell auth-shell-premium">
      <section className="auth-brand auth-brand-premium">
        <Link href="/" className="auth-logo-link">
          <span className="auth-brand-mark"><ShieldCheck size={18} /></span>
          <strong>CloudShield</strong>
        </Link>

        <div className="auth-hero-copy">
          <span className="auth-eyebrow">Enterprise security command center</span>
          <h1>Secure access to your cloud governance console.</h1>
          <p>
            Inspect AWS readiness, security findings, compliance evidence, inventory intelligence,
            reports, risk workflows, and governed operations from one premium workspace.
          </p>
        </div>

        <div className="auth-signal-card">
          <div>
            <span>Runtime posture</span>
            <strong>Ready</strong>
          </div>
          <div>
            <span>Evidence model</span>
            <strong>Database backed</strong>
          </div>
          <div>
            <span>Access mode</span>
            <strong>Governed</strong>
          </div>
        </div>

        <div className="auth-security-grid">
          <article>
            <span>01</span>
            <strong>AWS account readiness</strong>
            <p>Validate connector state before inventory and governance actions.</p>
          </article>
          <article>
            <span>02</span>
            <strong>Compliance evidence</strong>
            <p>Track controls, reports, audit records, and review status.</p>
          </article>
          <article>
            <span>03</span>
            <strong>Risk workflow</strong>
            <p>Review findings with ownership, approvals, and controlled remediation.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel auth-panel-premium">
        <div className="auth-card auth-card-premium">
          <span className="auth-card-kicker">Workspace sign in</span>
          <h2>Sign in</h2>
          <p>Use your CloudShield workspace account.</p>
          <LoginForm />
          <div className="auth-switch">
            New workspace? <Link href="/register">Create one</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
