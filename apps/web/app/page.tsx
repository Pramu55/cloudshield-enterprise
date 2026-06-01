import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Database,
  FileCheck2,
  Network,
  ShieldCheck
} from "lucide-react";
import { PLATFORM_TITLE } from "@cloudshield/types";

const signals = [
  { label: "Cloud accounts", value: "Multi-account ready" },
  { label: "Scanner mode", value: "Read-only foundation" },
  { label: "Remediation", value: "Execution blocked" }
];

const modules = [
  { name: "Security posture", icon: ShieldCheck },
  { name: "Cost governance", icon: BarChart3 },
  { name: "Asset inventory", icon: Database },
  { name: "Risk graph", icon: Network },
  { name: "Evidence center", icon: FileCheck2 }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-panel">
      <section className="border-b border-line bg-white">
        <div className="mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-between px-6 py-8">
          <nav className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-signal">
                CloudShield Enterprise
              </p>
              <p className="text-sm text-slate-600">{PLATFORM_TITLE}</p>
            </div>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white"
              href="/dashboard"
            >
              Open console <ArrowRight size={16} />
            </Link>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="max-w-4xl">
              <h1 className="text-5xl font-semibold leading-tight text-ink md:text-7xl">
                CloudShield Enterprise
              </h1>
              <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-700">
                Multi-account AWS governance for security posture, cost risk,
                compliance-style evidence, ownership, and safe remediation
                recommendations.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {signals.map((signal) => (
                  <div
                    className="rounded-md border border-line bg-panel p-4"
                    key={signal.label}
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {signal.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {signal.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-line bg-panel p-5">
              <p className="text-sm font-semibold text-ink">Foundation scope</p>
              <div className="mt-4 space-y-3">
                {modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <div
                      className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-3"
                      key={module.name}
                    >
                      <Icon className="text-signal" size={18} />
                      <span className="text-sm font-medium text-slate-800">
                        {module.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-slate-600">
          CloudShield v1 uses CIS-inspired controls, SOC2-inspired evidence,
          and internal cloud governance evidence. It does not claim official
          compliance certification.
        </p>
      </section>
    </main>
  );
}
