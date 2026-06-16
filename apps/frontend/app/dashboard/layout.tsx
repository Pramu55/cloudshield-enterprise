"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  HelpCircle,
  ShieldCheck,
  Building,
  Cloud,
  Settings,
  User
} from "lucide-react";
import { clearCsrfToken, fetchCloudShieldClient, useCloudShieldData } from "../../lib/client-api";
import { RouteIcon } from "./route-views";
import { GlobalSearchBar } from "../../components/search/GlobalSearchBar";
import { NotificationFeed } from "../../components/notifications/NotificationFeed";
import { NAV_GROUPS } from "../../lib/route-registry";
import type { CommandCenterResponse } from "@cloudshield/contracts";
import { ErrorState } from "../../components/ui/error-state";
import {
  FrontendCapabilitySessionSchema,
  FrontendCommandCenterResponseSchema,
  type FrontendCapabilitySession
} from "../../lib/response-contracts";

// Navigation filtering is presentation only; backend permission checks remain authoritative.
function canSee(item: { requiredCapability?: keyof FrontendCapabilitySession["capabilities"] }, session?: FrontendCapabilitySession | null) {
  if (!item.requiredCapability) return true;
  return Boolean(session?.capabilities[item.requiredCapability]);
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authState = useCloudShieldData<FrontendCapabilitySession | null>("/api/v1/auth/me", null, {
    schema: FrontendCapabilitySessionSchema
  });
  const user = authState.data?.user;

  const { data: commandCenterData } = useCloudShieldData<CommandCenterResponse | null>("/api/v1/dashboard/command-center", null, { schema: FrontendCommandCenterResponseSchema });

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(media.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("cloudshield.sidebar.collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("cloudshield.sidebar.collapsed", String(collapsed));
  }, [collapsed]);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS
      .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, authState.data)) }))
      .filter((group) => group.items.length);
  }, [authState.data]);

  useEffect(() => {
    setProfileOpen(false);
    setWorkspaceOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const links = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    links.forEach((href) => router.prefetch(href));
  }, [router]);

  async function logout() {
    try {
      await fetchCloudShieldClient("/api/v1/auth/logout", { method: "POST", handleSessionExpired: false });
    } catch {
      // Session may already be expired; route away either way.
    }
    clearCsrfToken();
    router.replace("/login");
    router.refresh();
  }

  const organizationName = authState.data?.organization.name ?? "Workspace";
  const userName = user?.name ?? user?.email ?? "Signed-in user";
  const userRole = user?.role ? user.role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "Member";

  const connectedAccounts = commandCenterData?.executiveSummary?.connectedAccounts;
  const totalAccounts = commandCenterData?.executiveSummary?.totalAccounts;
  const connectorStatus = commandCenterData?.accountHealth?.length ?
    (commandCenterData.accountHealth.some(a => a.connectionStatus === "VALIDATION_SUCCEEDED") ? "CONNECTED" : "NOT_CONFIGURED")
    : "NOT_CONFIGURED";

  if (authState.error?.sessionExpired) {
    return (
      <main className="portal-content" aria-live="assertive">
        <ErrorState title="Session expired" message={authState.error.safeMessage} />
      </main>
    );
  }

  const sidebar = (
    <aside className="portal-sidebar" data-collapsed={collapsed}>
      <div className="portal-brand">
        <Link href="/dashboard" aria-label="CloudShield dashboard">
          <span className="portal-brand-mark"><ShieldCheck size={20} /></span>
          {!collapsed ? <strong>CloudShield</strong> : null}
        </Link>
        <button
          className="portal-icon-button"
          onClick={() => {
            if (isDesktop) setCollapsed(v => !v);
            else setMobileOpen(false);
          }}
          type="button"
          aria-label={isDesktop ? (collapsed ? "Expand sidebar" : "Collapse sidebar") : "Close sidebar"}
        >
          {isDesktop ? (collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />) : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="portal-nav" aria-label="Dashboard navigation">
        {visibleGroups.map((group) => (
          <section key={group.label}>
            {!collapsed ? <p>{group.label}</p> : null}
            {group.items.map((item) => (
              <Link
                className="portal-nav-link"
                data-active={isActive(pathname, item.href)}
                href={item.href}
                key={item.href}
                title={collapsed ? item.label : undefined}
              >
                <RouteIcon name={item.icon} />
                {!collapsed ? <span>{item.label}</span> : null}
                {collapsed ? <em role="tooltip">{item.label}</em> : null}
              </Link>
            ))}
          </section>
        ))}
      </nav>

      <div className="portal-sidebar-footer">
      </div>
    </aside>
  );

  return (
    <div className="portal-shell" data-collapsed={collapsed}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="portal-desktop-sidebar">{sidebar}</div>
      <div className="portal-main">
        <header className="portal-topbar">
          <div className="portal-topbar-left flex-1 flex items-center relative">
            {!mobileOpen && (
              <button
                className="portal-icon-button lg:hidden mr-2"
                onClick={() => setMobileOpen(true)}
                type="button"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <div className="ml-4 flex-1">
              <GlobalSearchBar />
            </div>
          </div>
          <div className="portal-topbar-right relative">
            <button className="portal-icon-button relative" onClick={() => { setNotificationsOpen(v => !v); setWorkspaceOpen(false); setProfileOpen(false); }} type="button" aria-label="Notifications" aria-expanded={notificationsOpen}>
              <Bell size={17} />
            </button>
            {notificationsOpen ? <NotificationFeed /> : null}
            <button className="portal-icon-button" onClick={() => window.open('/docs', '_blank')} type="button" aria-label="Help">
              <HelpCircle size={17} />
            </button>

            <button className="portal-org hover:border-slate-300 transition-colors" onClick={() => { setWorkspaceOpen(v => !v); setProfileOpen(false); setNotificationsOpen(false); }} aria-label="Workspace" aria-expanded={workspaceOpen}>
              <span>{organizationName}</span>
            </button>
            {workspaceOpen ? (
              <div className="portal-popover absolute right-16 top-[52px] w-80 bg-white rounded-xl shadow-[0_35px_80px_-25px_rgba(15,23,42,0.6)] border border-[#d9dee7] z-50 overflow-hidden" role="menu">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <Building size={20} />
                  </div>
                  <div>
                    <strong className="block text-slate-900 text-sm">{organizationName}</strong>
                    <span className="text-xs text-slate-500">{userRole} • Single workspace</span>
                  </div>
                </div>
                <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 font-semibold">AWS Accounts</span>
                    <span className="text-sm font-bold text-slate-900">{totalAccounts !== undefined ? totalAccounts : "Unavailable"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 font-semibold">Connected</span>
                    <span className="text-sm font-bold text-slate-900">{connectedAccounts !== undefined ? connectedAccounts : "Unavailable"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 font-semibold">Connector State</span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-sm font-bold uppercase tracking-wider">{connectorStatus.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="p-2 flex flex-col">
                  <Link href="/dashboard/accounts" onClick={() => setWorkspaceOpen(false)} className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md font-medium flex items-center gap-2">
                    <Cloud size={16} className="text-slate-400" /> Manage AWS accounts
                  </Link>
                  <Link href="/dashboard/settings" onClick={() => setWorkspaceOpen(false)} className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md font-medium flex items-center gap-2">
                    <Settings size={16} className="text-slate-400" /> Workspace settings
                  </Link>
                </div>
              </div>
            ) : null}

            <button className="portal-user" onClick={() => { setProfileOpen((value) => !value); setWorkspaceOpen(false); setNotificationsOpen(false); }} type="button" aria-haspopup="menu" aria-expanded={profileOpen}>
              <span>{userName.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{userName}</strong>
                <p>{userRole}</p>
              </div>
            </button>
            {profileOpen ? (
              <div className="portal-popover absolute right-0 top-[52px] w-72 bg-white rounded-xl shadow-[0_35px_80px_-25px_rgba(15,23,42,0.6)] border border-[#d9dee7] z-50 overflow-hidden" role="menu">
                <div className="p-4 border-b border-[#d9dee7] flex items-start gap-3 bg-white">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-inner">
                    {userName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <strong className="text-slate-900 text-sm truncate">{userName}</strong>
                    <span className="text-slate-500 text-xs truncate">{user?.email ?? "No email"}</span>
                  </div>
                </div>
                <div className="p-2">
                  <Link href="/dashboard/profile" onClick={() => setProfileOpen(false)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md font-semibold transition-colors">
                    <User size={16} className="text-slate-400" /> Profile settings
                  </Link>
                </div>
                <div className="p-2 border-t border-[#d9dee7] bg-slate-50">
                  <button className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg font-bold transition-all shadow-sm" onClick={logout} type="button" role="menuitem">
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>
        <main className="portal-content" id="main-content" tabIndex={-1}>{children}</main>
      </div>

      {mobileOpen ? <div className="portal-mobile-backdrop" onClick={() => setMobileOpen(false)} /> : null}
      <div className="portal-mobile-sidebar" data-open={mobileOpen}>{sidebar}</div>
    </div>
  );
}
