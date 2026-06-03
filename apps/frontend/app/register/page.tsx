import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  return (
    <main className="portal-auth flex min-h-screen items-center justify-center px-6">
      <section className="portal-auth-card w-full max-w-md rounded-md border border-line bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="cs-action-primary flex h-10 w-10 items-center justify-center rounded-md">
            <Building2 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Create workspace</h1>
            <p className="text-sm text-slate-600">
              Client-evaluation ready CloudShield access
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Work email
            <input
              className="mt-2 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-signal"
              placeholder="you@company.com"
              type="email"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Organization
            <input
              className="mt-2 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-signal"
              placeholder="Company or evaluation workspace"
              type="text"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              className="mt-2 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-signal"
              placeholder="Create a password"
              type="password"
            />
          </label>
          <button
            className="cs-action-primary flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold"
            type="button"
          >
            <ShieldCheck size={16} />
            Request evaluation workspace
          </button>
        </form>

        <div className="mt-5 rounded-md border border-warning/40 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
          Registration is prepared as a future enterprise onboarding workflow.
          Use the demo login for the current local foundation. No AWS connector,
          scanner, mutation, or remediation is enabled from this page.
        </div>

        <div className="mt-5 border-t border-line pt-4 text-sm text-slate-600">
          Already have access?{" "}
          <Link className="font-semibold text-signal" href="/login">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
