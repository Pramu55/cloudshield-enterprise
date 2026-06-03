"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, CheckCircle2, ShieldAlert, Award } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

export default function RegisterPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validations
    if (!email.trim() || !organization.trim() || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid work email.");
      return;
    }

    if (!organization.trim()) {
      setError("Organization name is required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.trim(),
          organization: organization.trim(),
          password,
          confirmPassword
        })
      });

      if (response.status === 409) {
        setError("This email already has access. Please sign in instead.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || "Server unavailable. Please try again.");
        return;
      }

      setSuccessMsg("Workspace request created.");
      
      // Auto redirect to login after a brief success delay
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(email.trim())}`);
      }, 1500);
    } catch {
      setError("Server unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="portal-auth flex min-h-screen items-stretch">
      {/* Left side: Workspace Onboarding Information */}
      <section className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-slate-955 text-white relative overflow-hidden border-r border-slate-800">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-650 text-white shadow-lg">
            <Shield size={22} />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">CloudShield</span>
            <p className="text-xs text-slate-400">AWS Cloud Governance & Security Posture</p>
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-8">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
              Create your secure evaluation workspace.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-350">
              Set up a local tenant environment to inspect resources, view compliance scorecards, and test manual risk mitigation workflows.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-100">Isolated Organization Account</p>
                <p className="text-xs text-slate-400 mt-0.5">Every registration creates a fully containerized tenant boundary, maintaining strict database-level isolation rules.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <ShieldAlert className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-100">Evaluator Safe-Playground</p>
                <p className="text-xs text-slate-400 mt-0.5">Explore standard dashboard posture modules, reports export, and risk acceptance queue triggers without AWS security exposure.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Award className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-100">Credential-Ready Path</p>
                <p className="text-xs text-slate-400 mt-0.5">Easily transition your workspace to read-only AWS auditing later by configuring secure role assumption credentials.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          CloudShield local evaluator foundation &copy; 2026. All rights reserved.
        </div>
      </section>

      {/* Right side: Signup Form */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:w-1/2 bg-slate-55">
        <div className="w-full max-w-md space-y-6">
          {/* Logo visible on mobile only */}
          <div className="flex items-center gap-3 lg:hidden justify-center mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-655 text-white shadow-lg">
              <Shield size={20} />
            </div>
            <span className="text-lg font-bold text-slate-900">CloudShield</span>
          </div>

          <div className="portal-auth-card w-full rounded-md border border-line bg-white p-8">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Request evaluation workspace</h2>
              <p className="mt-1.5 text-xs text-slate-650">Sign up to request access and deploy a sandboxed cloud governance demo</p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Work Email
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal focus:ring-1 focus:ring-signal"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  value={email}
                  disabled={isSubmitting}
                />
              </label>

              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Organization / Workspace Name
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal focus:ring-1 focus:ring-signal"
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder="Acme Corp"
                  type="text"
                  value={organization}
                  disabled={isSubmitting}
                />
              </label>

              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Password
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal focus:ring-1 focus:ring-signal"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  type="password"
                  value={password}
                  disabled={isSubmitting}
                />
              </label>

              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Confirm Password
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal focus:ring-1 focus:ring-signal"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter password"
                  type="password"
                  value={confirmPassword}
                  disabled={isSubmitting}
                />
              </label>

              {error && (
                <div className="rounded-md border border-alert/30 bg-rose-50 px-3 py-2 text-xs font-medium text-alert">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="rounded-md border border-emerald-350 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  {successMsg}
                </div>
              )}

              <button
                className="cs-action-primary flex h-11 w-full items-center justify-center rounded-md text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Creating evaluation workspace..." : "Deploy evaluation workspace"}
              </button>

              <p className="text-[11px] leading-relaxed text-slate-500 pt-2 border-t border-slate-100">
                <strong>Safety Notice:</strong> No AWS credentials or secrets are requested on this page. CloudShield operates strictly in a locally sandboxed mode by default.
              </p>
            </form>

            <div className="mt-6 border-t border-line pt-4 text-xs text-slate-600 text-center">
              Already have access?{" "}
              <Link className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors" href="/login">
                Sign in instead
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
