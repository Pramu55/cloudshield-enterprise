"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Command,
  LogOut,
  HelpCircle,
  Menu,
  Search,
  ShieldCheck,
  X
} from "lucide-react";
import { clearCsrfToken, fetchCloudShieldClient, useCloudShieldData } from "../../lib/client-api";
import { RouteIcon } from "./route-views";
import { GlobalSearchTrigger } from "../../components/search/GlobalSearchTrigger";
import { GlobalSearchDialog } from "../../components/search/GlobalSearchDialog";

type CurrentUserPayload = {
  user?: {
    name?: string;
    email?: string;
    role?: string;
    organizationName?: string;
  };
};

type NavItem = {
  label: string;
  href: string;
  icon: string;
  roles?: string[];
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: "overview" }]
  },
  {
    label: "Cloud",
    items: [
      { label: "Accounts", href: "/dashboard/accounts", icon: "accounts" },
      { label: "Inventory", href: "/dashboard/inventory", icon: "inventory" },
      { label: "Resource graph", href: "/dashboard/graph", icon: "graph" },
      { label: "Cost", href: "/dashboard/cost", icon: "cost" }
    ]
  },
  {
    label: "Security",
    items: [
      { label: "Findings", href: "/dashboard/security", icon: "security" },
      { label: "Governance", href: "/dashboard/governance", icon: "governance" },
      { label: "Compliance", href: "/dashboard/compliance", icon: "compliance" },
      { label: "Recommendations", href: "/dashboard/recommendations", icon: "recommendations" }
    ]
  },
  {
    label: "Operations",
    items: [
      { label: "Automation", href: "/dashboard/automation", icon: "automation" },
      { label: "Scans", href: "/dashboard/scans", icon: "scans" },
      { label: "Reports", href: "/dashboard/reports", icon: "reports" }
    ]
  },
  {
    label: "Administration",
    items: [
      { label: "Settings", href: "/dashboard/settings", icon: "settings", roles: ["OWNER", "ADMIN"] },
      { label: "Members", href: "/dashboard/settings/members", icon: "members", roles: ["OWNER", "ADMIN"] }
    ]
  }
];

function canSee(item: NavItem, role?: string) {
  if (!item.roles?.length) return true;
  return item.roles.includes(String(role ?? "").toUpperCase());
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useCloudShieldData<CurrentUserPayload>("/api/v1/auth/me", {});
  const user = data.user;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(media.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const toggleMenu = () => {
    if (isDesktop) {
      setCollapsed(prev => !prev);
    } else {
      setMobileOpen(prev => !prev);
    }
  };

  useEffect(() => {
    const saved = window.localStorage.getItem("cloudshield.sidebar.collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("cloudshield.sidebar.collapsed", String(collapsed));
  }, [collapsed]);

  const visibleGroups = useMemo(() => {
    return navGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, user?.role)) }))
      .filter((group) => group.items.length);
  }, [user?.role]);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const links = navGroups.flatMap((group) => group.items.map((item) => item.href));
    links.forEach((href) => router.prefetch(href));
  }, [router]);

  async function logout() {
    try {
      await fetchCloudShieldClient("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Session may already be expired; route away either way.
    }
    clearCsrfToken();
    router.replace("/login");
    router.refresh();
  }

  const organizationName = user?.organizationName ?? "Workspace";
  const userName = user?.name ?? user?.email ?? "Signed-in user";
  const userRole = user?.role ? user.role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "Member";

  const sidebar = (
    <aside className="portal-sidebar" data-collapsed={collapsed}>
      <div className="portal-brand">
        <Link href="/dashboard" aria-label="CloudShield dashboard">
          <span><ShieldCheck size={20} /></span>
          {!collapsed ? <strong>CloudShield</strong> : null}
        </Link>
        <button className="portal-icon-button portal-mobile-close" onClick={() => setMobileOpen(false)} type="button" aria-label="Close navigation">
          <X size={18} />
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
        <button className="portal-collapse" onClick={() => setCollapsed((value) => !value)} type="button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="portal-shell" data-collapsed={collapsed}>
      <div className="portal-desktop-sidebar">{sidebar}</div>
      {mobileOpen ? <div className="portal-mobile-backdrop" onClick={() => setMobileOpen(false)} /> : null}
      <div className="portal-mobile-sidebar" data-open={mobileOpen}>{sidebar}</div>

      <div className="portal-main">
        <header className="portal-topbar">
          <div className="portal-topbar-left">
            <button className="portal-icon-button portal-sidebar-toggle" onClick={toggleMenu} type="button" aria-label="Toggle navigation">
              <Menu size={18} />
            </button>
            <GlobalSearchTrigger onOpen={() => setSearchOpen(true)} />
          </div>
          <div className="portal-topbar-right">
            <button className="portal-icon-button" onClick={() => setNotificationsOpen((value) => !value)} type="button" aria-label="Notifications" aria-expanded={notificationsOpen}>
              <Bell size={17} />
            </button>
            {notificationsOpen ? (
              <div className="portal-popover portal-notifications">
                <strong>Notifications</strong>
                <p>No new notifications.</p>
              </div>
            ) : null}
            <button className="portal-icon-button" type="button" aria-label="Help">
              <HelpCircle size={17} />
            </button>
            <div className="portal-org" aria-label="Organization">
              <span>{organizationName}</span>
            </div>
            <button className="portal-user" onClick={() => setProfileOpen((value) => !value)} type="button" aria-haspopup="menu" aria-expanded={profileOpen}>
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
                <dl>
                  <div><dt>Organization</dt><dd>{organizationName}</dd></div>
                  <div><dt>Role</dt><dd>{userRole}</dd></div>
                </dl>
                <button className="portal-profile-logout" onClick={logout} type="button" role="menuitem">
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="portal-content">{children}</main>
      </div>
      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
