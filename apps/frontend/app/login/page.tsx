"use client";

import { Shield, CheckCircle2, Database, Eye, Lock, Zap, Globe } from "lucide-react";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="portal-auth flex min-h-screen items-stretch">
      {/* Left side: Evaluation & Architecture Panel */}
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
              <h1 className="text-xl font-bold tracking-tight text-white">CloudShield</h1>
              <p className="text-[11px] font-medium text-slate-400 tracking-wide">AWS Cloud Governance & Security Posture</p>
            </div>
          </div>

          {/* Hero content */}
          <div className="my-auto max-w-lg space-y-10 py-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-300 mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Enterprise Security Platform
              </div>
              <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-[1.15] text-white">
                Enterprise security controls
                <span className="block mt-1" style={{ background: "linear-gradient(90deg, #818cf8 0%, #2dd4bf 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  at your fingertips.
                </span>
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-400 max-w-md">
                Evaluate and monitor security, compliance, and cost governance across multiple AWS accounts from a safe, sandboxed environment.
              </p>
            </div>

            <div className="space-y-5">
              {[
                {
                  icon: <CheckCircle2 size={18} />,
                  title: "Safe Local-Evaluator Sandbox",
                  desc: "Loads findings, controls, and recommendations from a secure PostgreSQL database. Live AWS SDK calls are disabled by default."
                },
                {
                  icon: <Database size={18} />,
                  title: "Zero DB Secret Storage",
                  desc: "We never request or save raw AWS secrets/keys in the database. Production operations leverage environment-scoped IAM role assumptions."
                },
                {
                  icon: <Eye size={18} />,
                  title: "CIS & SOC2-Inspired Posture",
                  desc: "Interactive dashboards reference mapping frameworks for audit evidence tracking (internal governance context)."
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

      {/* Right side: Login form */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:w-[48%] bg-[#f8fafc]">
        <div className="w-full max-w-md space-y-6">
          {/* Logo only visible on mobile */}
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
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Sign in to console</h2>
              <p className="mt-1.5 text-sm text-slate-500">Enter your credentials to manage your cloud posture workspace</p>
            </div>

            <LoginForm />

            <div className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-600 text-center">
              New evaluator?{" "}
              <Link className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors" href="/register">
                Request workspace access
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
              <Database size={10} />
              No Credential Storage
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
