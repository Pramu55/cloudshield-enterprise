"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bot,
  Grid3X3,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  HelpCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Building,
  BookOpen,
  CheckCircle2,
  Cloud,
  ExternalLink,
  Settings,
  Terminal,
  X,
  User
} from "lucide-react";
import { clearCsrfToken, fetchCloudShieldClient, useCloudShieldData } from "../../lib/client-api";
import { RouteIcon } from "./route-views";
import { NotificationFeed } from "../../components/notifications/NotificationFeed";
import { NAV_GROUPS, ROUTE_REGISTRY, type RouteMetadata } from "../../lib/route-registry";
import { ErrorState } from "../../components/ui/error-state";
import {
  FrontendCapabilitySessionSchema,
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

type ThemePreference = "light" | "dark" | "system";
type DensityPreference = "comfortable" | "standard" | "compact";

const THEME_STORAGE_KEY = "cloudshield-theme";
const DENSITY_STORAGE_KEY = "cloudshield-density";
const RECENT_ROUTES_STORAGE_KEY = "cloudshield-recent-routes";

function resolveThemePreference(theme: ThemePreference) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyDisplayPreferences(theme: ThemePreference, density: DensityPreference) {
  document.documentElement.setAttribute("data-theme", resolveThemePreference(theme));
  document.documentElement.setAttribute("data-density", density);
}

function routeTitleFor(pathname: string) {
  const exact = ROUTE_REGISTRY.find((route) => route.href === pathname);
  if (exact) return exact;
  return ROUTE_REGISTRY.find((route) => pathname === route.href || pathname.startsWith(`${route.href}/`));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authState = useCloudShieldData<FrontendCapabilitySession | null>("/api/v1/auth/me", null, {
    schema: FrontendCapabilitySessionSchema
  });
  const user = authState.data?.user;
  const readinessState = useCloudShieldData<PlatformReadinessPayload | null>("/api/v1/platform/readiness", null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appLauncherOpen, setAppLauncherOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [shellOpen, setShellOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [densityPreference, setDensityPreference] = useState<DensityPreference>("standard");
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
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const savedDensity = window.localStorage.getItem(DENSITY_STORAGE_KEY);
    const safeTheme: ThemePreference = savedTheme === "light" || savedTheme === "dark" || savedTheme === "system" ? savedTheme : "system";
    const safeDensity: DensityPreference = savedDensity === "comfortable" || savedDensity === "compact" || savedDensity === "standard" ? savedDensity : "standard";
    setThemePreference(safeTheme);
    setDensityPreference(safeDensity);
    applyDisplayPreferences(safeTheme, safeDensity);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("cloudshield.sidebar.collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    window.localStorage.setItem(DENSITY_STORAGE_KEY, densityPreference);
    applyDisplayPreferences(themePreference, densityPreference);
    if (themePreference !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyDisplayPreferences("system", densityPreference);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [densityPreference, themePreference]);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS
      .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, authState.data)) }))
      .filter((group) => group.items.length);
  }, [authState.data]);

  useEffect(() => {
    setAppLauncherOpen(false);
    setMobileOpen(false);
    setProfileOpen(false);
    setWorkspaceOpen(false);
    setShellOpen(false);
    setRegionOpen(false);
    setNotificationsOpen(false);
    setHelpOpen(false);
    setSettingsOpen(false);
    setCopilotOpen(false);

    const route = routeTitleFor(pathname);
    if (!route) return;
    const safeRecord = {
      pathname,
      title: route.label,
      category: route.category,
      timestamp: new Date().toISOString()
    };
    try {
      const existing = JSON.parse(window.localStorage.getItem(RECENT_ROUTES_STORAGE_KEY) ?? "[]") as typeof safeRecord[];
      const next = [safeRecord, ...existing.filter((item) => item.pathname !== pathname)].slice(0, 6);
      window.localStorage.setItem(RECENT_ROUTES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      window.localStorage.setItem(RECENT_ROUTES_STORAGE_KEY, JSON.stringify([safeRecord]));
    }
  }, [pathname]);

  useEffect(() => {
    const links = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    links.forEach((href) => router.prefetch(href));
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAppLauncherOpen(false);
      setShellOpen(false);
      setRegionOpen(false);
      setNotificationsOpen(false);
      setHelpOpen(false);
      setSettingsOpen(false);
      setWorkspaceOpen(false);
      setProfileOpen(false);
      setCopilotOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".cs-console-topbar, .portal-popover, .cs-app-launcher-menu, .copilot-panel")) return;
      setAppLauncherOpen(false);
      setShellOpen(false);
      setRegionOpen(false);
      setNotificationsOpen(false);
      setHelpOpen(false);
      setSettingsOpen(false);
      setWorkspaceOpen(false);
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

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
  const totalAccounts = readinessState.data?.awsAccountsCount;
  const connectorStatus = readinessState.data?.connectorMode
    ? readinessState.data.connectorMode.replace(/-/g, " ")
    : "not reported";

  if (authState.error?.sessionExpired) {
    return (
      <main className="portal-content" aria-live="assertive">
        <ErrorState title="Session expired" message={authState.error.safeMessage} />
      </main>
    );
  }

  const sidebar = (
    <aside className="cs-console-sidebar" data-collapsed={collapsed}>
      <div className="cs-console-sidebar-head">
        {!collapsed ? (
          <div>
            <strong>CloudShield</strong>
            <span>Governance console</span>
          </div>
        ) : null}
        <button
          className="cs-console-icon-button"
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

      <nav className="cs-console-nav" aria-label="Dashboard navigation">
        {visibleGroups.map((group) => (
          <section key={group.label}>
            {!collapsed ? <p>{group.label}</p> : null}
            {group.items.map((item) => (
              <Link
                className="cs-console-nav-link"
                data-active={isActive(pathname, item.href)}
                href={item.href}
                key={item.href}
                onMouseEnter={() => router.prefetch(item.href)}
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
    </aside>
  );

  return (
    <div className="cs-console-shell" data-collapsed={collapsed}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="cs-console-topbar">
        <div className="cs-console-topbar-left">
          <button className="cs-console-launcher" onClick={() => { setAppLauncherOpen((value) => !value); setMobileOpen(false); setRegionOpen(false); setShellOpen(false); setProfileOpen(false); setNotificationsOpen(false); setHelpOpen(false); setSettingsOpen(false); setCopilotOpen(false); setWorkspaceOpen(false); }} type="button" aria-label="Open app launcher" aria-expanded={appLauncherOpen}>
            <Grid3X3 size={17} />
          </button>
          {appLauncherOpen ? (
            <div className="cs-app-launcher-menu">
              <div className="cs-app-launcher-head">
                <strong>CloudShield workspaces</strong>
                <span>Route launcher · no AWS call</span>
              </div>
              {[
                { href: "/dashboard", title: "Dashboard", description: "Console home and posture summary", icon: "overview" },
                { href: "/dashboard/accounts", title: "Accounts", description: "AWS account registry", icon: "accounts" },
                { href: "/dashboard/inventory", title: "Inventory", description: "Stored resource explorer", icon: "inventory" },
                { href: "/dashboard/graph", title: "Resource Graph", description: "Relationship workspace", icon: "graph" },
                { href: "/dashboard/security", title: "Security Findings", description: "Open posture findings", icon: "security" },
                { href: "/dashboard/compliance", title: "Compliance", description: "Readiness mapping", icon: "compliance" },
                { href: "/dashboard/reports", title: "Reports", description: "DB-only proof exports", icon: "reports" },
                { href: "/dashboard/settings", title: "Settings", description: "Runtime and workspace settings", icon: "settings" }
              ].map((item) => (
                <Link href={item.href} key={item.href} onClick={() => setAppLauncherOpen(false)} onMouseEnter={() => router.prefetch(item.href)}>
                  <span><RouteIcon name={item.icon} /></span>
                  <strong>{item.title}</strong>
                  <em>{item.description}</em>
                </Link>
              ))}
            </div>
          ) : null}
          <Link className="cs-console-brand" href="/dashboard" aria-label="CloudShield console home">
            <span><ShieldCheck size={16} /></span>
            <strong>CloudShield</strong>
          </Link>
          <ConsoleCommandSearch />
        </div>
        <div className="cs-console-topbar-right">
            <button
              className="cs-console-copilot-button"
              onClick={() => {
                setCopilotOpen(true);
                setShellOpen(false);
                setRegionOpen(false);
                setNotificationsOpen(false);
                setWorkspaceOpen(false);
                setProfileOpen(false);
                setHelpOpen(false);
                setSettingsOpen(false);
                setMobileOpen(false);
              }}
              type="button"
              aria-label="Open CloudShield Copilot"
              aria-expanded={copilotOpen}
            >
              <Bot size={16} />
              <span>Copilot</span>
            </button>
            <button
              className="cs-console-icon-button"
              onClick={() => {
                setShellOpen((value) => !value);
                setRegionOpen(false);
                setCopilotOpen(false);
                setNotificationsOpen(false);
                setWorkspaceOpen(false);
                setProfileOpen(false);
                setHelpOpen(false);
                setMobileOpen(false);
              }}
              type="button"
              title="Open local command status"
              aria-label="Local command status"
              aria-expanded={shellOpen}
            >
              <Terminal size={16} />
            </button>
            {shellOpen ? (
              <aside className="portal-popover portal-runtime-status" aria-label="Local command status">
                <div className="portal-shell-head">
                  <Terminal size={18} />
                  <div>
                    <strong>Local command status</strong>
                    <p>Read-only console helpers</p>
                  </div>
                </div>
                <div className="portal-shell-list">
                  <p><span>Runtime</span><strong>DB-backed console</strong></p>
                  <p><span>AWS calls</span><strong>Disabled from UI</strong></p>
                  <p><span>Scanner</span><strong>{readinessState.data?.scannerMode ?? "not reported"}</strong></p>
                </div>
                <Link href="/dashboard/monitoring" onClick={() => setShellOpen(false)}>
                  Open monitoring workspace <ExternalLink size={14} />
                </Link>
              </aside>
            ) : null}
            <button className="cs-console-icon-button relative" onClick={() => { setNotificationsOpen((value) => !value); setShellOpen(false); setRegionOpen(false); setWorkspaceOpen(false); setProfileOpen(false); setHelpOpen(false); setSettingsOpen(false); setAppLauncherOpen(false); }} type="button" aria-label="Notifications" aria-expanded={notificationsOpen}>
              <Bell size={17} />
            </button>
            {notificationsOpen ? <NotificationFeed /> : null}
            <button className="cs-console-icon-button" onClick={() => { setHelpOpen((value) => !value); setShellOpen(false); setRegionOpen(false); setNotificationsOpen(false); setWorkspaceOpen(false); setProfileOpen(false); setSettingsOpen(false); setAppLauncherOpen(false); }} type="button" aria-label="Help and setup guide" aria-expanded={helpOpen}>
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
                  <p data-complete={Boolean(readinessState.data?.connectorMode)}><CheckCircle2 size={15} /> Validate role-based AWS identity</p>
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

            <button
              className="cs-console-icon-button"
              onClick={() => {
                setSettingsOpen((value) => !value);
                setRegionOpen(false);
                setShellOpen(false);
                setWorkspaceOpen(false);
                setNotificationsOpen(false);
                setHelpOpen(false);
                setProfileOpen(false);
                setMobileOpen(false);
                setCopilotOpen(false);
                setAppLauncherOpen(false);
              }}
              type="button"
              aria-label="Settings"
              aria-expanded={settingsOpen}
            >
              <Settings size={16} />
            </button>
            {settingsOpen ? (
              <aside className="portal-popover cs-settings-menu" aria-label="Display settings">
                <div className="cs-settings-menu-head">
                  <strong>Display settings</strong>
                  <span>Local browser preferences</span>
                </div>
                <div className="cs-settings-menu-group">
                  <span>Theme</span>
                  <div className="cs-segmented-control">
                    {(["light", "dark", "system"] as ThemePreference[]).map((option) => (
                      <button key={option} type="button" data-active={themePreference === option} onClick={() => setThemePreference(option)}>
                        {option === "light" ? "Light" : option === "dark" ? "Dark" : "System"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="cs-settings-menu-group">
                  <span>Density</span>
                  <div className="cs-segmented-control">
                    {(["comfortable", "standard", "compact"] as DensityPreference[]).map((option) => (
                      <button key={option} type="button" data-active={densityPreference === option} onClick={() => setDensityPreference(option)}>
                        {option === "comfortable" ? "Comfortable" : option === "compact" ? "Compact" : "Standard"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="cs-settings-safety">
                  <p><span>Scanner</span><strong>{readinessState.data?.scannerMode ?? "disabled"}</strong></p>
                  <p><span>Change execution</span><strong>disabled</strong></p>
                  <p><span>Executor role</span><strong>disabled</strong></p>
                  <p><span>Reports</span><strong>DB-only</strong></p>
                  <p><span>Region</span><strong>ap-south-1 locked</strong></p>
                </div>
                <Link href="/dashboard/settings" onClick={() => setSettingsOpen(false)}>Open full workspace settings <ExternalLink size={14} /></Link>
              </aside>
            ) : null}
            <button
              className="cs-console-region"
              onClick={() => { setRegionOpen((value) => !value); setWorkspaceOpen(false); setShellOpen(false); setProfileOpen(false); setNotificationsOpen(false); setHelpOpen(false); setSettingsOpen(false); setCopilotOpen(false); setAppLauncherOpen(false); setMobileOpen(false); }}
              type="button"
              title="Region is fixed by runtime safety config."
              aria-label="Region selection"
              aria-expanded={regionOpen}
            >
              ap-south-1
            </button>
            {regionOpen ? (
              <aside className="portal-popover portal-region" aria-label="Region safety menu">
                <strong>Asia Pacific (Mumbai) · ap-south-1</strong>
                <p>Sandbox proof is locked to the approved account and region. Scanner remains disabled, and this UI does not perform live AWS refreshes.</p>
                <Link href="/dashboard/accounts" onClick={() => setRegionOpen(false)}>Open accounts workspace</Link>
              </aside>
            ) : null}
            <button className="cs-console-workspace" onClick={() => { setWorkspaceOpen((value) => !value); setRegionOpen(false); setShellOpen(false); setProfileOpen(false); setNotificationsOpen(false); setHelpOpen(false); setSettingsOpen(false); setCopilotOpen(false); setAppLauncherOpen(false); setMobileOpen(false); }} type="button" aria-label="Workspace" aria-expanded={workspaceOpen}>
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
                  <div><dt>Runtime guardrail</dt><dd>Read-only</dd></div>
                  <div><dt>Connector state</dt><dd>{connectorStatus.replace(/_/g, " ")}</dd></div>
                </dl>
                <div className="portal-workspace-links">
                  <Link href="/dashboard/accounts" onClick={() => setWorkspaceOpen(false)}><Cloud size={16} />Manage AWS accounts</Link>
                  <Link href="/dashboard/settings" onClick={() => setWorkspaceOpen(false)}><Settings size={16} />Workspace settings</Link>
                </div>
              </div>
            ) : null}

            <button className="cs-console-user" onClick={() => { setProfileOpen((value) => !value); setRegionOpen(false); setShellOpen(false); setWorkspaceOpen(false); setNotificationsOpen(false); setHelpOpen(false); setSettingsOpen(false); setAppLauncherOpen(false); }} type="button" aria-haspopup="menu" aria-expanded={profileOpen}>
              <span>{userName.slice(0, 1).toUpperCase()}</span>
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
      <div className="cs-console-app">
        <div className="cs-console-desktop-sidebar">{sidebar}</div>
        <div className="cs-console-main">
        <section className="cs-console-safety-strip" aria-label="CloudShield runtime safety">
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
        <main className="cs-console-content" id="main-content" tabIndex={-1}>{children}</main>
        </div>
      </div>

      {mobileOpen ? <div className="portal-mobile-backdrop" onClick={() => setMobileOpen(false)} /> : null}
      <div className="portal-mobile-sidebar" data-open={mobileOpen}>{sidebar}</div>
      <CloudShieldCopilotPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}

function ConsoleCommandSearch() {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const trimmedQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    const ranked = ROUTE_REGISTRY.map((route, index) => {
      if (!trimmedQuery) return { route, score: index < 9 ? 2 : 99 };
      const haystack = [route.label, route.category, route.description ?? "", ...route.keywords].join(" ").toLowerCase();
      const exact = route.label.toLowerCase() === trimmedQuery;
      const prefix = route.label.toLowerCase().startsWith(trimmedQuery);
      const keyword = haystack.includes(trimmedQuery);
      return { route, score: exact ? 0 : prefix ? 1 : keyword ? 2 : 99 };
    });
    return ranked
      .filter((item) => item.score < 99)
      .sort((a, b) => a.score - b.score || a.route.label.localeCompare(b.route.label))
      .slice(0, 9)
      .map((item) => item.route);
  }, [trimmedQuery]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function openRoute(route: RouteMetadata) {
    setOpen(false);
    setQuery("");
    router.push(route.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setSelectedIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && results[selectedIndex]) {
      event.preventDefault();
      openRoute(results[selectedIndex]);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) setQuery("");
      else setOpen(false);
    }
  }

  return (
    <div className="console-command-search" ref={wrapperRef}>
      <div className="console-command-search-field">
        <Search size={15} />
        <input
          ref={inputRef}
          aria-label="Search CloudShield routes"
          placeholder="Search services, resources, findings, reports..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
            <X size={14} />
          </button>
        ) : <kbd>Ctrl K</kbd>}
      </div>
      {open ? (
        <div className="cs-command-search-results" role="listbox" aria-label="CloudShield command search results">
          <div className="console-command-categories">
            <strong>All</strong>
            {["Services", "Resources", "Findings", "Reports", "Documentation"].map((category) => <span key={category}>{category}</span>)}
          </div>
          <div className="console-command-list">
            <div className="console-command-list-head">
              <strong>{trimmedQuery ? "Matching CloudShield workspaces" : "Console shortcuts"}</strong>
              <span>Frontend route search · no AWS call</span>
            </div>
            {results.length ? results.map((route, index) => (
              <button
                key={route.id}
                type="button"
                role="option"
                aria-selected={index === selectedIndex}
                data-selected={index === selectedIndex}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => openRoute(route)}
              >
                <span className="console-command-icon"><RouteIcon name={route.icon} /></span>
                <span>
                  <strong>{route.label}</strong>
                  <em>{route.category} · {route.description ?? "CloudShield workspace"}</em>
                </span>
                <small>Open</small>
              </button>
            )) : (
              <div className="console-command-empty">
                <strong>No route found</strong>
                <p>Try inventory, findings, reports, settings, members, or compliance.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type CopilotPrompt = {
  prompt: string;
  answer: string;
  href?: string;
  action?: string;
};

const COPILOT_PROMPTS: CopilotPrompt[] = [
  {
    prompt: "Show me active findings",
    answer: "Security findings are available in the findings workspace. This local guidance mode only routes you to stored CloudShield data.",
    href: "/dashboard/security",
    action: "Open findings"
  },
  {
    prompt: "Open inventory explorer",
    answer: "Inventory explorer browses DB-backed AWS_SYNC snapshots and sample records. It does not refresh AWS or run scanner jobs.",
    href: "/dashboard/inventory",
    action: "Open inventory"
  },
  {
    prompt: "Explain why remediation is disabled",
    answer: "Remediation is disabled because CloudShield is in a review-only safety posture: change execution is disabled and the executor role is not configured.",
    href: "/dashboard/settings",
    action: "Open settings"
  },
  {
    prompt: "Export governance proof",
    answer: "Governance proof export is available from Reports. Exports are DB-backed evidence/report workflows, not live AWS calls.",
    href: "/dashboard/reports",
    action: "Open reports"
  },
  {
    prompt: "Show compliance readiness",
    answer: "Compliance shows internal readiness mappings and evidence coverage. CloudShield does not claim official SOC 2, ISO, or CIS certification.",
    href: "/dashboard/compliance",
    action: "Open compliance"
  },
  {
    prompt: "Open runtime safety settings",
    answer: "Runtime safety is visible in Settings and the top safety strip. Scanner, mutation, remediation, and Terraform are disabled in this locked posture.",
    href: "/dashboard/settings",
    action: "Open settings"
  }
];

const DEFAULT_COPILOT_PROMPT: CopilotPrompt = {
  prompt: "Open inventory explorer",
  answer: "Inventory explorer browses DB-backed AWS_SYNC snapshots and sample records. It does not refresh AWS or run scanner jobs.",
  href: "/dashboard/inventory",
  action: "Open inventory"
};

function CloudShieldCopilotPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedPrompt, setSelectedPrompt] = useState<CopilotPrompt>(COPILOT_PROMPTS[1] ?? DEFAULT_COPILOT_PROMPT);
  const [input, setInput] = useState("");

  function submitPrompt(promptText: string) {
    const normalized = promptText.toLowerCase();
    const prompt = COPILOT_PROMPTS.find((item) => normalized.includes(item.prompt.toLowerCase().slice(0, 10)))
      ?? COPILOT_PROMPTS.find((item) => item.prompt.toLowerCase().split(" ").some((word) => word.length > 4 && normalized.includes(word)))
      ?? {
        prompt: promptText || "Local guidance",
        answer: "I can help navigate CloudShield routes and explain the current safe posture. Try inventory, findings, reports, compliance, or remediation disabled.",
        href: "/dashboard",
        action: "Open console home"
      };
    setSelectedPrompt(prompt);
    setInput("");
  }

  return (
    <>
      {open ? <div className="copilot-backdrop" onClick={onClose} /> : null}
      <aside className="copilot-panel" data-open={open} aria-hidden={!open} aria-label="CloudShield Copilot local guidance panel">
        <div className="copilot-header">
          <span><Bot size={20} /></span>
          <div>
            <strong>CloudShield Copilot</strong>
            <p>Local guidance mode · no external AI provider</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close CloudShield Copilot"><X size={17} /></button>
        </div>
        <div className="copilot-body">
          <div className="copilot-intro">
            <Sparkles size={16} />
            <p>Ask about accounts, inventory, findings, compliance, and safety posture. Responses are rule-based and route-aware only.</p>
          </div>
          <div className="copilot-prompts">
            {COPILOT_PROMPTS.map((prompt) => (
              <button key={prompt.prompt} type="button" onClick={() => setSelectedPrompt(prompt)}>
                {prompt.prompt}
              </button>
            ))}
          </div>
          <div className="copilot-answer">
            <span>Local answer</span>
            <strong>{selectedPrompt.prompt}</strong>
            <p>{selectedPrompt.answer}</p>
            {selectedPrompt.href ? <Link className="cs-button-secondary" href={selectedPrompt.href} onClick={onClose}>{selectedPrompt.action ?? "Open workspace"}</Link> : null}
          </div>
        </div>
        <form className="copilot-input" onSubmit={(event) => { event.preventDefault(); submitPrompt(input); }}>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask local guidance..." aria-label="Ask CloudShield Copilot local guidance" />
          <button type="submit" className="cs-button">Ask</button>
        </form>
        <p className="copilot-footnote">Future scope: optional AI provider integration after security review. No AWS, secrets, or external LLM calls are made here.</p>
      </aside>
    </>
  );
}
