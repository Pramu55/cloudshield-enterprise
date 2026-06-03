"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, CheckCircle2, ShieldAlert, Award, Loader2, ArrowRight, Lock, Zap, Globe, Info } from "lucide-react";

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
      <section className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0c1222 0%, #111827 40%, #0f172a 100%)" }}>
        {/* Animated background orbs */}
        <div className="absolute top-[-80px] left-[-60px] w-[420px] h-[420px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)", animation: "pulse 8s ease-in-out infinite" }} />
        <div className="absolute bottom-[-100px] right-[-80px] w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #0d9488 0%, transparent 70%)", animation: "pulse 10s ease-in-out infinite 2s" }} />
        <div className="absolute top-1/2 left-1/3 w-[200px] h-[200px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", animation: "pulse 6s ease-in-out infinite 4s" }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)" }}>
              <Shield size={22} />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">CloudShield</span>
              <p className="text-[11px] font-medium text-slate-400 tracking-wide">AWS Cloud Governance & Security Posture</p>
            </div>
          </div>

          {/* Hero content */}
          <div className="my-auto max-w-lg space-y-10 py-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-[11px] font-semibold text-teal-300 mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                Workspace Onboarding
              </div>
              <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-[1.15] text-white">
                Create your secure
                <span className="block mt-1" style={{ background: "linear-gradient(90deg, #2dd4bf 0%, #818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  evaluation workspace.
                </span>
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-400 max-w-md">
                Set up a local tenant environment to inspect resources, view compliance scorecards, and test manual risk mitigation workflows.
              </p>
            </div>

            <div className="space-y-5">
              {[
                {
                  icon: <CheckCircle2 size={18} />,
                  title: "Isolated Organization Account",
                  desc: "Every registration creates a fully containerized tenant boundary, maintaining strict database-level isolation rules."
                },
                {
                  icon: <ShieldAlert size={18} />,
                  title: "Evaluator Safe-Playground",
                  desc: "Explore standard dashboard posture modules, reports export, and risk acceptance queue triggers without AWS security exposure."
                },
                {
                  icon: <Award size={18} />,
                  title: "Credential-Ready Path",
                  desc: "Easily transition your workspace to read-only AWS auditing later by configuring secure role assumption credentials."
                }
              ].map((item) => (
                <div key={item.title} className="flex gap-4 group">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-500/30 bg-teal-500/10 text-teal-400 transition-colors group-hover:bg-teal-500/20 group-hover:border-teal-500/50">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Platform badges */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: <Lock size={12} />, label: "Read-Only" },
                { icon: <Zap size={12} />, label: "No Mutations" },
                { icon: <Globe size={12} />, label: "Multi-Region" },
                { icon: <Shield size={12} />, label: "Sandboxed" }
              ].map((badge) => (
                <span key={badge.label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[10px] font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800">
                  {badge.icon}
                  {badge.label}
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>CloudShield local evaluator foundation &copy; 2026</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              System operational
            </span>
          </div>
        </div>
      </section>

      {/* Right side: Signup Form */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:w-[48%] bg-[#f8fafc]">
        <div className="w-full max-w-md space-y-6">
          {/* Logo visible on mobile only */}
          <div className="flex items-center gap-3 lg:hidden justify-center mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)" }}>
              <Shield size={20} />
            </div>
            <span className="text-lg font-bold text-slate-900">CloudShield</span>
          </div>

          <div className="w-full rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.03)" }}>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Request evaluation workspace</h2>
              <p className="mt-1.5 text-sm text-slate-500">Sign up to request access and deploy a sandboxed cloud governance demo</p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Work Email</span>
                <input
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  value={email}
                  disabled={isSubmitting}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Organization / Workspace Name</span>
                <input
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400"
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder="Acme Corp"
                  type="text"
                  value={organization}
                  disabled={isSubmitting}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Password</span>
                <input
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  type="password"
                  value={password}
                  disabled={isSubmitting}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Confirm Password</span>
                <input
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter password"
                  type="password"
                  value={confirmPassword}
                  disabled={isSubmitting}
                />
              </label>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700"
                  style={{ animation: "fadeIn 0.2s ease-out" }}>
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700"
                  style={{ animation: "fadeIn 0.2s ease-out" }}>
                  <Loader2 size={14} className="animate-spin text-emerald-600" />
                  {successMsg}
                </div>
              )}

              <button
                className="cs-action-primary flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating evaluation workspace...
                  </>
                ) : (
                  <>
                    Deploy evaluation workspace
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                <Info size={13} className="shrink-0 mt-0.5 text-slate-400" />
                <span>
                  <strong className="text-slate-600">Safety Notice:</strong> No AWS credentials or secrets are requested on this page. CloudShield operates strictly in a locally sandboxed mode by default.
                </span>
              </div>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-600 text-center">
              Already have access?{" "}
              <Link className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors" href="/login">
                Sign in instead
              </Link>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Lock size={10} />
              TLS Secured
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <Shield size={10} />
              SOC2-Ready
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={10} />
              No Credential Storage
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
