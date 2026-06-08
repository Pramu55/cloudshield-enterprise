"use client";

import Link from "next/link";
import { ShieldCheck, DatabaseZap, Lock, Eye, Activity } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-shell bg-[#f8fafc] min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left Panel: Enterprise Branding */}
      <section className="hidden lg:flex flex-col justify-between p-12 bg-[#020617] text-white relative overflow-hidden">
        {/* Subtle grid/glow effects */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none"></div>

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 no-underline">
            <span className="grid place-items-center w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 text-orange-500 shadow-lg">
              <ShieldCheck size={20} />
            </span>
            <strong className="text-2xl tracking-tight font-extrabold text-white">CloudShield</strong>
          </Link>

          <div className="mt-24 max-w-lg">
            <h1 className="text-4xl font-extrabold tracking-tight mb-6 leading-[1.15]">
              Enterprise cloud posture <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">and security operations.</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed font-medium mb-12">
              Sign in to your isolated workspace to inspect cloud inventory, security findings, compliance evidence, and governed operations.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="mt-1 w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 text-sky-400">
                  <Eye size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Read-only Discovery</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Agentless, read-only scanning of your AWS infrastructure with zero operational impact.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="mt-1 w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
                  <Lock size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Strict Tenant Isolation</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Dedicated workspace environments logically separated to prevent cross-tenant data exposure.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="mt-1 w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 text-orange-400">
                  <Activity size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">No Autonomous Mutations</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Remediation requires explicit manual approval. The platform never mutates your cloud autonomously.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-auto pt-12">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-widest border-t border-slate-800 pt-6">
            <span>© {new Date().getFullYear()} CloudShield Security</span>
            <div className="flex gap-4">
              <span className="hover:text-slate-300 transition-colors cursor-pointer">Privacy</span>
              <span className="hover:text-slate-300 transition-colors cursor-pointer">Terms</span>
            </div>
          </div>
        </div>
      </section>

      {/* Right Panel: Login Form */}
      <section className="flex flex-col items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[440px]">
          {/* Mobile-only brand header */}
          <div className="lg:hidden flex justify-center mb-10">
            <Link href="/" className="inline-flex items-center gap-3 no-underline">
              <span className="grid place-items-center w-10 h-10 rounded-lg bg-slate-900 text-orange-500 shadow-md">
                <ShieldCheck size={20} />
              </span>
              <strong className="text-2xl tracking-tight font-extrabold text-slate-900">CloudShield</strong>
            </Link>
          </div>

          <div className="bg-white rounded-[20px] p-8 sm:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-slate-200">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-[28px] font-extrabold text-slate-900 mb-2 tracking-tight">Sign in</h2>
              <p className="text-[15px] text-slate-500 font-medium">Continue to your CloudShield workspace.</p>
            </div>

            <LoginForm />

            <div className="mt-8 text-center sm:text-left text-[14px] text-slate-600 font-medium border-t border-slate-100 pt-6">
              New workspace? <Link href="/register" className="text-orange-600 hover:text-orange-700 font-bold ml-1 transition-colors">Create one</Link>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-bold transition-colors">
              ← Back to CloudShield
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
