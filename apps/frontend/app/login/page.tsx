import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-6">
      <section className="w-full max-w-md rounded-md border border-line bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-white">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">CloudShield</h1>
            <p className="text-sm text-slate-600">Foundation login shell</p>
          </div>
        </div>
        <form className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-2 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-signal"
              placeholder="security@example.com"
              type="email"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              className="mt-2 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-signal"
              placeholder="Foundation only"
              type="password"
            />
          </label>
          <Link
            className="flex h-11 w-full items-center justify-center rounded-md bg-ink text-sm font-semibold text-white"
            href="/dashboard"
          >
            Continue to console
          </Link>
        </form>
      </section>
    </main>
  );
}
