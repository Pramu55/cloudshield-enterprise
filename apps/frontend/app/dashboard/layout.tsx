"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cloud,
  Database,
  FileCheck2,
  Gauge,
  HelpCircle,
  Menu,
  Network,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  Wrench
} from "lucide-react";
import { LogoutButton } from "./logout-button";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: Gauge, group: "General" },
  { href: "/dashboard/accounts", label: "Accounts", icon: Cloud, group: "Governance" },
  { href: "/dashboard/inventory", label: "Inventory", icon: Database, group: "Governance" },
  { href: "/dashboard/graph", label: "Risk Graph", icon: Network, group: "Governance" },
  { href: "/dashboard/security", label: "Security", icon: ShieldAlert, group: "Operations" },
  { href: "/dashboard/cost", label: "Cost", icon: BarChart3, group: "Operations" },
  { href: "/dashboard/compliance", label: "Compliance", icon: FileCheck2, group: "Operations" },
  { href: "/dashboard/recommendations", label: "Recommendations", icon: Wrench, group: "Operations" },
  { href: "/dashboard/scans", label: "Scans", icon: ClipboardList, group: "Monitoring" },
  { href: "/dashboard/reports", label: "Reports", icon: ScrollText, group: "Monitoring" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, group: "Manage" }
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    navItems.forEach((item) => router.prefetch(item.href));
  }, [router]);

  useEffect(() => {
    const savedState = window.localStorage.getItem("cloudshield_sidebar_collapsed");
    setIsSidebarCollapsed(savedState === "true");
  }, []);

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

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("cloudshield_sidebar_collapsed", String(next));
      return next;
    });
  }

  const showConsole = useMemo(
    () => authState === "authenticated" || Boolean(currentUser),
    [authState, currentUser]
  );

  const activeItem = navItems.find((item) => item.href === pathname) ?? navItems[0]!;
  const ActiveIcon = activeItem.icon;

  // Simple avatar generation
  const userInitials = useMemo(() => {
    if (!currentUser?.user.email) return "CS";
    const namePart = currentUser.user.name || currentUser.user.email.split("@")[0] || "CS";
    return namePart.substring(0, 2).toUpperCase();
  }, [currentUser]);

  if (authState === "checking") {
    return <PortalLoading label="Loading CloudShield console..." />;
  }

  if (!showConsole) {
    return <PortalLoading label="Redirecting to login..." />;
  }

  return (
    <main className="portal-app">
      <header className="portal-topbar sticky top-0 z-30 flex h-14 items-center px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-400">
            <Cloud size={22} className="stroke-[2.5]" />
          </div>
          <Link className="flex flex-col text-[16px] font-bold tracking-tight text-white" href="/dashboard">
            <span>CloudShield</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-normal -mt-1">Enterprise Console</span>
          </Link>
        </div>

        <div className="mx-8 hidden h-9 max-w-xl flex-1 items-center gap-3 px-3 text-sm lg:flex portal-search">
          <Search size={16} className="text-slate-400" />
          <span className="text-slate-400 text-xs">Search accounts, compliance controls, and resources (Press ⌘K)</span>
        </div>

        <div className="ml-auto flex h-full items-center gap-1">
          <span className="status-pill mr-2 border-indigo-500/30 bg-indigo-950/40 text-indigo-400 text-[11px] font-semibold py-1">
            <span className="status-dot-pulse bg-indigo-400" />
            Evaluation Mode
          </span>
          <TopbarButton label="Activity" icon={<Activity size={17} />} />
          <TopbarButton label="Notifications" icon={<Bell size={17} />} />
          <TopbarButton label="Help" icon={<HelpCircle size={17} />} />
          <div className="mx-2 h-6 border-l border-slate-700" />
          <div className="flex items-center gap-3 pl-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 font-bold text-xs text-white">
              {userInitials}
            </div>
            <div className="hidden flex-col text-left md:flex">
              <span className="text-xs font-semibold text-white leading-3">
                {currentUser?.user.name || "CloudShield User"}
              </span>
              <span className="text-[10px] text-slate-400">
                {currentUser?.organization.name || "Demo Tenant"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`grid min-h-[calc(100vh-56px)] transition-[grid-template-columns] duration-200 ${
          isSidebarCollapsed ? "lg:grid-cols-[60px_1fr]" : "lg:grid-cols-[240px_1fr]"
        }`}
      >
        <aside className="portal-nav hidden min-w-0 lg:flex flex-col justify-between py-2">
          <div>
            <div className="flex h-11 items-center justify-between border-b border-slate-800 px-4 mb-2">
              {!isSidebarCollapsed ? (
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Navigation
                </p>
              ) : null}
              <button
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="portal-icon-button ml-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
                onClick={toggleSidebar}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                type="button"
              >
                {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>

            <nav className="space-y-1">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const previousGroup = navItems[index - 1]?.group;
                const showGroup = !isSidebarCollapsed && item.group !== previousGroup;

                return (
                  <div key={item.href}>
                    {showGroup ? (
                      <p className="px-4 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {item.group}
                      </p>
                    ) : null}
                    <Link
                      className={`portal-nav-link flex h-9 items-center text-sm ${
                        isSidebarCollapsed ? "justify-center px-0 mx-2" : "gap-3 px-3 mx-3"
                      }`}
                      data-active={pathname === item.href}
                      href={item.href}
                      prefetch
                      title={item.label}
                    >
                      <Icon className="shrink-0" size={16} />
                      {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="px-3 py-2 border-t border-slate-800">
            {!isSidebarCollapsed ? (
              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                  Safety Guardrails
                </p>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  Read-Only console logic active. No AWS mutation allowed.
                </p>
              </div>
            ) : (
              <div className="flex justify-center text-slate-500" title="Safety active">
                <ShieldAlert size={16} className="text-indigo-400" />
              </div>
            )}
          </div>
        </aside>

        <section className="portal-content min-w-0">
          <div className="portal-commandbar sticky top-14 z-20 flex min-h-12 flex-wrap items-center justify-between gap-2 px-6 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <ActiveIcon className="shrink-0" size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink leading-tight">{activeItem.label}</p>
                <p className="truncate text-[11px] text-slate-500 mt-0.5">
                  CloudShield Governance Hub &bull; Stored DB records mode
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => router.refresh()}
                type="button"
              >
                <RefreshCw size={12} className="text-slate-500" />
                Refresh view
              </button>
              <span className="status-pill border-amber-200 bg-amber-50/50 text-amber-700 text-[11px] font-semibold py-1">
                <span className="status-dot-pulse bg-amber-500" />
                Scanner Offline
              </span>
              {currentUser ? <LogoutButton /> : null}
            </div>
          </div>
          <div className="p-1">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function PortalLoading({ label }: { label: string }) {
  return (
    <main className="portal-auth flex min-h-screen items-center justify-center px-6">
      <section className="portal-auth-card w-full max-w-sm border bg-white p-6 text-center rounded-xl shadow-xl">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-3" />
        <p className="text-sm font-semibold text-ink">{label}</p>
      </section>
    </main>
  );
}

function TopbarButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      className="portal-icon-button flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}
