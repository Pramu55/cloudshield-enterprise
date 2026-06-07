"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <Link href="/">
          <span className="auth-brand-mark"><ShieldCheck size={18} /></span>
          <strong>CloudShield</strong>
        </Link>
        <div>
          <h1>Secure access to the CloudShield console.</h1>
          <p>Sign in to inspect cloud account posture, findings, evidence, reports, and governed operations.</p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>Sign in</h2>
          <p>Use your workspace account.</p>
          <LoginForm />
          <div className="auth-switch">
            New workspace? <Link href="/register">Create one</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
