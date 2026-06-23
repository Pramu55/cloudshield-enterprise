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
  BookOpen,
  CheckCircle2,
  Cloud,
  ExternalLink,
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

type PlatformReadinessPayload = {
  awsAccountsCount?: number;
  connectorMode?: string;
  scannerMode?: string;
  isReadyForReadOnlyScans?: boolean;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authState = useCloudShieldData<FrontendCapabilitySession | null>("/api/v1/auth/me", null, {
    schema: FrontendCapabilitySessionSchema
  });
  const user = authState.data?.user;
  const { data: commandCenterData } = useCloudShieldData<CommandCenterResponse | null>(
    "/api/v1/dashboard/command-center",
    null,
    { schema: FrontendCommandCenterResponseSchema }
  );
  const readinessState = useCloudShieldData<PlatformReadinessPayload | null>("/api/v1/platform/readiness", null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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
  const primaryGroups = visibleGroups.filter((group) => group.label !== "Administration");
  const administrationItems = visibleGroups.find((group) => group.label === "Administration")?.items ?? [];

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
    setWorkspaceOpen(false);
    setNotificationsOpen(false);
    setHelpOpen(false);
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
  const connectorStatus = commandCenterData?.accountHealth?.length
    ? commandCenterData.accountHealth.some((account) => account.connectionStatus === "VALIDATION_SUCCEEDED")
      ? "CONNECTED"
      : "NOT_CONFIGURED"
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
            if (isDesktop) setCollapsed((value) => !value);
            else setMobileOpen(false);
          }}
          type="button"
          aria-label={isDesktop ? (collapsed ? "Expand sidebar" : "Collapse sidebar") : "Close sidebar"}
        >
          {isDesktop ? (collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />) : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="portal-nav" aria-label="Dashboard navigation">
        {primaryGroups.map((group) => (
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
        {!collapsed ? <p>Administration</p> : null}
        {administrationItems.map((item) => (
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
            {!mobileOpen ? (
              <button className="portal-icon-button lg:hidden mr-2" onClick={() => setMobileOpen(true)} type="button" aria-label="Open sidebar">
                <PanelLeftOpen size={18} />
              </button>
            ) : null}
            <div className="ml-4 flex-1"><GlobalSearchBar /></div>
          </div>
          <div className="portal-topbar-right relative">
            <button className="portal-icon-button relative" onClick={() => { setNotificationsOpen((value) => !value); setWorkspaceOpen(false); setProfileOpen(false); setHelpOpen(false); }} type="button" aria-label="Notifications" aria-expanded={notificationsOpen}>
              <Bell size={17} />
            </button>
            {notificationsOpen ? <NotificationFeed /> : null}
            <button className="portal-icon-button" onClick={() => { setHelpOpen((value) => !value); setNotificationsOpen(false); setWorkspaceOpen(false); setProfileOpen(false); }} type="button" aria-label="Help and setup guide" aria-expanded={helpOpen}>
              <HelpCircle size={17} />
            </button>
            {helpOpen ? (
              <aside className="portal-popover portal-help" aria-label="CloudShield help and setup guide">
                <div className="portal-help-head">
                  <span><BookOpen size={20} /></span>
                  <div>
                    <strong>CloudShield setup guide</strong>
                    <p>Platform status and safe next steps</p>
                  </div>
                </div>
                <div className="portal-help-status">
                  <div>
                    <span>Platform API</span>
                    <strong data-tone={readinessState.error ? "warning" : "success"}>
                      {readinessState.error ? "Check required" : "Available"}
                    </strong>
                  </div>
                  <div>
                    <span>AWS accounts</span>
                    <strong>{readinessState.data?.awsAccountsCount ?? totalAccounts ?? 0}</strong>
                  </div>
                  <div>
                    <span>Connector mode</span>
                    <strong>{readinessState.data?.connectorMode ?? "Not reported"}</strong>
                  </div>
                  <div>
                    <span>Scanner mode</span>
                    <strong>{readinessState.data?.scannerMode ?? "Not reported"}</strong>
                  </div>
                </div>
                <div className="portal-help-checklist">
                  <h3>Setup checklist</h3>
                  <p><CheckCircle2 size={15} /> Sign-in and tenant boundary active</p>
                  <p data-complete={Boolean(totalAccounts)}><CheckCircle2 size={15} /> Register a non-production AWS account</p>
                  <p data-complete={connectorStatus === "CONNECTED"}><CheckCircle2 size={15} /> Validate role-based AWS identity</p>
                  <p data-complete={Boolean(readinessState.data?.isReadyForReadOnlyScans)}><CheckCircle2 size={15} /> Enable approved read-only inventory mode</p>
                </div>
                <div className="portal-help-links">
                  <Link href="/dashboard/accounts" onClick={() => setHelpOpen(false)}><Cloud size={16} />AWS account setup<ExternalLink size={14} /></Link>
                  <Link href="/dashboard/monitoring" onClick={() => setHelpOpen(false)}><ShieldCheck size={16} />Monitoring status<ExternalLink size={14} /></Link>
                  <Link href="/dashboard/settings" onClick={() => setHelpOpen(false)}><Settings size={16} />Workspace settings<ExternalLink size={14} /></Link>
                </div>
                <p className="portal-help-note">Use the repository runbooks for IAM trust policy, sandbox validation, inventory sync, and governed-operation incident handling. Production mutation remains blocked by design.</p>
              </aside>
            ) : null}

            <button className="portal-org" onClick={() => { setWorkspaceOpen((value) => !value); setProfileOpen(false); setNotificationsOpen(false); setHelpOpen(false); }} type="button" aria-label="Workspace" aria-expanded={workspaceOpen}>
              <span>{organizationName}</span>
            </button>
            {workspaceOpen ? (
              <div className="portal-popover portal-workspace" role="menu">
                <div className="portal-workspace-head">
                  <span><Building size={20} /></span>
                  <div><strong>{organizationName}</strong><p>{userRole} · Single workspace</p></div>
                </div>
                <dl>
                  <div><dt>AWS accounts</dt><dd>{totalAccounts ?? "Unavailable"}</dd></div>
                  <div><dt>Connected</dt><dd>{connectedAccounts ?? "Unavailable"}</dd></div>
                  <div><dt>Connector state</dt><dd>{connectorStatus.replace(/_/g, " ")}</dd></div>
                </dl>
                <div className="portal-workspace-links">
                  <Link href="/dashboard/accounts" onClick={() => setWorkspaceOpen(false)}><Cloud size={16} />Manage AWS accounts</Link>
                  <Link href="/dashboard/settings" onClick={() => setWorkspaceOpen(false)}><Settings size={16} />Workspace settings</Link>
                </div>
              </div>
            ) : null}

            <button className="portal-user" onClick={() => { setProfileOpen((value) => !value); setWorkspaceOpen(false); setNotificationsOpen(false); setHelpOpen(false); }} type="button" aria-haspopup="menu" aria-expanded={profileOpen}>
              <span>{userName.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{userName}</strong>
                <p>{userRole}</p>
              </div>
            </button>
            {profileOpen ? (
              <div className="portal-popover portal-profile" role="menu">
                <div className="portal-profile-head">
                  <span>{userName.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{userName}</strong>
                    <p>{user?.email ?? "No email reported"}</p>
                  </div>
                </div>
                <div className="portal-profile-links">
                  <Link href="/dashboard/profile" onClick={() => setProfileOpen(false)}><User size={16} />Profile settings</Link>
                </div>
                <button className="portal-profile-logout" onClick={logout} type="button" role="menuitem">
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <section className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 md:px-6" aria-label="CloudShield runtime safety">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black uppercase tracking-wide text-slate-500">Pilot / local</span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-bold text-blue-700">
              Read-only locked
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold text-slate-700">
              Connector: {readinessState.data?.connectorMode ?? "not reported"}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-bold text-blue-700">
              Scanner: {readinessState.data?.scannerMode ?? "not reported"}
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-800">
              Mutation / remediation / Terraform disabled
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold text-slate-700">
              Reports are DB-only
            </span>
          </div>
        </section>
        <main className="portal-content" id="main-content" tabIndex={-1}>{children}</main>
      </div>

      {mobileOpen ? <div className="portal-mobile-backdrop" onClick={() => setMobileOpen(false)} /> : null}
      <div className="portal-mobile-sidebar" data-open={mobileOpen}>{sidebar}</div>
    </div>
  );
}
