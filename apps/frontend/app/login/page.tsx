"use client";

import Link from "next/link";
import { CheckCircle2, Database, Lock, ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="aws-auth-page">
      <header className="aws-public-topbar">
        <Link className="aws-public-brand" href="/">
          <span><ShieldCheck size={18} /></span>
          <strong>CloudShield</strong>
        </Link>
        <nav aria-label="Auth navigation">
          <Link href="/register">Create workspace</Link>
        </nav>
      </header>

      <section className="aws-auth-shell">
        <div className="aws-auth-card">
          <div className="aws-auth-summary">
            <span className="aws-kicker">
              <Lock size={14} />
              Secure console access
            </span>
            <h1>Sign in to CloudShield</h1>
            <p>
              Access the protected cloud governance workspace for account posture,
              security findings, evidence, and reports.
            </p>
            <div className="aws-auth-badges">
              <span><CheckCircle2 size={14} /> Read-only by default</span>
              <span><Database size={14} /> Evidence ready</span>
              <span><Lock size={14} /> No DB secrets</span>
            </div>
            <div className="aws-auth-alert">
              Login does not run AWS validation, inventory sync, AWS APIs, mutation,
              Terraform apply, or automatic remediation.
            </div>
          </div>
          <div className="aws-auth-form-panel">
            <h2>Sign in to console</h2>
            <p>Use the local demo credentials or your workspace account.</p>
            <LoginForm />
            <div className="aws-auth-switch">
              New evaluator? <Link href="/register">Create evaluation workspace</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
