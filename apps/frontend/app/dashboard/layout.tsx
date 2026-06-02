"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

type CurrentUser = {
  user: { email: string; name: string | null; role: string };
  organization: { name: string };
};

type AuthState = "checking" | "authenticated" | "anonymous";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

export default function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    navItems.forEach((item) => router.prefetch(item.href));
  }, [router]);

  useEffect(() => {
    const token = window.localStorage.getItem("cloudshield_access_token");
    setAuthState(token ? "authenticated" : "anonymous");

    const cachedUser = window.localStorage.getItem("cloudshield_current_user");
    if (cachedUser) {
      try {
        setCurrentUser(JSON.parse(cachedUser) as CurrentUser);
      } catch {
        window.localStorage.removeItem("cloudshield_current_user");
      }
    }

    if (!token) {
      return;
    }

    fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: CurrentUser | null) => {
        if (payload) {
          setCurrentUser(payload);
          window.localStorage.setItem(
            "cloudshield_current_user",
            JSON.stringify(payload)
          );
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (authState === "anonymous") {
      router.replace("/login");
    }
  }, [authState, router]);

  const showConsole = useMemo(
    () => authState === "authenticated" || Boolean(currentUser),
    [authState, currentUser]
  );

  if (authState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-panel px-6">
        <section className="rounded-md border border-line bg-white px-5 py-4 text-sm font-semibold text-ink">
          Loading CloudShield console...
        </section>
      </main>
    );
  }

  if (!showConsole) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-panel px-6">
        <section className="rounded-md border border-line bg-white px-5 py-4 text-sm font-semibold text-ink">
          Redirecting to login...
        </section>
      </main>
    );
  }

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
                  className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-panel hover:text-ink ${
                    pathname === item.href
                      ? "bg-panel text-ink"
                      : "text-slate-700"
                  }`}
                  href={item.href}
                  key={item.href}
                  prefetch
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
                CLOUDSHIELD_ENTERPRISE_CLIENT_PLATFORM_BLUEPRINT_GREEN
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
          {children}
        </section>
      </div>
    </main>
  );
}
