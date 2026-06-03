"use client";

import { Shield, CheckCircle2, Database, Eye } from "lucide-react";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="portal-auth flex min-h-screen items-stretch">
      {/* Left side: Evaluation & Architecture Panel */}
      <section className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-slate-950 text-white relative overflow-hidden border-r border-slate-800">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-650 text-white shadow-lg">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">CloudShield</h1>
            <p className="text-xs text-slate-400">AWS Cloud Governance & Security Posture</p>
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-8">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
              Enterprise security controls & posture at your fingertips.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Evaluate and monitor security, compliance, and cost governance across multiple AWS accounts from a safe, sandboxed environment.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-100">Safe Local-Evaluator Sandbox</p>
                <p className="text-xs text-slate-400 mt-0.5">Loads findings, controls, and recommendations from a secure PostgreSQL database. Live AWS SDK calls are disabled by default.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Database className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-100">Zero DB Secret Storage</p>
                <p className="text-xs text-slate-400 mt-0.5">We never request or save raw AWS secrets/keys in the database. Production operations leverage environment-scoped IAM role assumptions.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Eye className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-100">CIS & SOC2-Inspired Posture</p>
                <p className="text-xs text-slate-400 mt-0.5">Interactive dashboards reference mapping frameworks for audit evidence tracking (internal mock governance context).</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          CloudShield local evaluator foundation &copy; 2026. All rights reserved.
        </div>
      </section>

      {/* Right side: Login form */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:w-1/2 bg-slate-50">
        <div className="w-full max-w-md space-y-6">
          {/* Logo only visible on mobile */}
          <div className="flex items-center gap-3 lg:hidden justify-center mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-650 text-white shadow-lg">
              <Shield size={20} />
            </div>
            <span className="text-lg font-bold text-slate-900">CloudShield</span>
          </div>

          <div className="portal-auth-card w-full rounded-md border border-line bg-white p-8">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Sign in to console</h2>
              <p className="mt-1.5 text-xs text-slate-650">Enter your credentials to manage your cloud posture workspace</p>
            </div>

            <LoginForm />

            <div className="mt-6 border-t border-line pt-4 text-xs text-slate-600 text-center">
              New evaluator?{" "}
              <Link className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors" href="/register">
                Request workspace access
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
