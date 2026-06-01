import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  Cloud,
  Database,
  FileCheck2,
  Gauge,
  Network,
  ScrollText,
  Settings,
  ShieldAlert,
  Wrench
} from "lucide-react";
import { fetchCurrentUser } from "../../lib/api";
import { LogoutButton } from "./logout-button";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/dashboard/accounts", label: "Accounts", icon: Cloud },
  { href: "/dashboard/inventory", label: "Inventory", icon: Database },
  { href: "/dashboard/graph", label: "Risk Graph", icon: Network },
  { href: "/dashboard/security", label: "Security", icon: ShieldAlert },
  { href: "/dashboard/cost", label: "Cost", icon: BarChart3 },
  { href: "/dashboard/compliance", label: "Compliance", icon: FileCheck2 },
  { href: "/dashboard/recommendations", label: "Recommendations", icon: Wrench },
  { href: "/dashboard/scans", label: "Scans", icon: ClipboardList },
  { href: "/dashboard/reports", label: "Reports", icon: ScrollText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await fetchCurrentUser();

  return (
    <main className="min-h-screen bg-panel">
      <div className="grid min-h-screen lg:grid-cols-[264px_1fr]">
        <aside className="border-r border-line bg-white">
          <div className="border-b border-line p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-signal">
              CloudShield
            </p>
            <h1 className="mt-1 text-lg font-semibold text-ink">
              Governance Console
            </h1>
          </div>
          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-panel hover:text-ink"
                  href={item.href}
                  key={item.href}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <section className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b border-line bg-white px-6">
            <div>
              <p className="text-sm font-semibold text-ink">
                CLOUDSHIELD_AUTH_AND_TENANT_FOUNDATION_GREEN
              </p>
              <p className="text-xs text-slate-500">
                Read-only posture, evidence, recommendations, and tenant-scoped access
              </p>
            </div>
            <div className="flex items-center gap-3">
              {currentUser && (
                <div className="text-right">
                  <p className="text-xs font-semibold text-ink">
                    {currentUser.user.email}
                  </p>
                  <p className="text-xs text-slate-500">
                    {currentUser.organization.name}
                  </p>
                </div>
              )}
              <div className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-signal">
                AWS scanner not configured
              </div>
              {currentUser && <LogoutButton />}
            </div>
          </header>
          {currentUser ? (
            children
          ) : (
            <div className="px-6 py-6">
              <section className="rounded-md border border-line bg-white p-6">
                <p className="text-sm font-semibold text-ink">Please log in</p>
                <p className="mt-2 text-sm text-slate-600">
                  CloudShield dashboard data is scoped to an authenticated
                  organization.
                </p>
                <Link
                  className="mt-4 inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
                  href="/login"
                >
                  Open login
                </Link>
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
