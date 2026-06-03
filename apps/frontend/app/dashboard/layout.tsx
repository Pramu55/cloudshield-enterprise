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

  if (authState === "checking") {
    return <PortalLoading label="Loading CloudShield console..." />;
  }

  if (!showConsole) {
    return <PortalLoading label="Redirecting to login..." />;
  }

  return (
    <main className="portal-app">
      <header className="portal-topbar sticky top-0 z-30 flex h-12 items-center">
        <div className="flex h-full w-12 items-center justify-center">
          <Menu size={20} />
        </div>
        <Link className="flex h-full min-w-52 items-center px-2 text-[15px] font-semibold" href="/dashboard">
          CloudShield
        </Link>
        <div className="mx-4 hidden h-8 max-w-2xl flex-1 items-center gap-2 px-3 text-sm lg:flex portal-search">
          <Search size={16} />
          <span className="text-slate-600">Search resources, services, and docs</span>
        </div>
        <div className="ml-auto flex h-full items-center">
          <TopbarButton label="Activity" icon={<Activity size={17} />} />
          <TopbarButton label="Notifications" icon={<Bell size={17} />} />
          <TopbarButton label="Help" icon={<HelpCircle size={17} />} />
          <div className="hidden h-full items-center border-l border-white/20 px-4 text-xs md:flex">
            {currentUser?.organization.name || "CloudShield workspace"}
          </div>
        </div>
      </header>

      <div
        className={`grid min-h-[calc(100vh-48px)] transition-[grid-template-columns] duration-200 ${
          isSidebarCollapsed ? "lg:grid-cols-[52px_1fr]" : "lg:grid-cols-[236px_1fr]"
        }`}
      >
        <aside className="portal-nav hidden min-w-0 lg:block">
          <div className="flex h-11 items-center justify-between border-b border-line">
            {!isSidebarCollapsed ? (
              <p className="px-4 text-xs font-semibold uppercase text-slate-500">
                Cloud resources
              </p>
            ) : null}
            <button
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="portal-icon-button ml-auto flex h-11 w-12 items-center justify-center text-slate-600 hover:bg-panel"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              type="button"
            >
              {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <nav className="py-2">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const previousGroup = navItems[index - 1]?.group;
              const showGroup = !isSidebarCollapsed && item.group !== previousGroup;

              return (
                <div key={item.href}>
                  {showGroup ? (
                    <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase text-slate-500">
                      {item.group}
                    </p>
                  ) : null}
                  <Link
                    className={`portal-nav-link flex h-9 items-center text-sm ${
                      isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"
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
        </aside>

        <section className="portal-content min-w-0">
          <div className="portal-commandbar sticky top-12 z-20 flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-1.5">
            <div className="flex min-w-0 items-center gap-3">
              <ActiveIcon className="hidden shrink-0 text-signal sm:block" size={18} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{activeItem.label}</p>
                <p className="truncate text-xs text-slate-500">
                  CloudShield local release / read-only governance workspace
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-2 border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                onClick={() => router.refresh()}
                type="button"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <span className="hidden border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 md:inline-flex">
                Scanner disabled
              </span>
              {currentUser ? (
                <div className="hidden text-right md:block">
                  <p className="text-xs font-semibold text-ink">{currentUser.user.email}</p>
                  <p className="text-xs text-slate-500">{currentUser.organization.name}</p>
                </div>
              ) : null}
              {currentUser ? <LogoutButton /> : null}
            </div>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

function PortalLoading({ label }: { label: string }) {
  return (
    <main className="portal-auth flex min-h-screen items-center justify-center px-6">
      <section className="portal-auth-card w-full max-w-sm border bg-white px-5 py-4 text-sm font-semibold text-ink">
        {label}
      </section>
    </main>
  );
}

function TopbarButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      className="portal-icon-button flex h-12 w-11 items-center justify-center text-white hover:bg-white/10"
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}
