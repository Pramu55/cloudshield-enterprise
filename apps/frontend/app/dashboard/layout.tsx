"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Command,
  HelpCircle,
  Menu,
  Search,
  ShieldCheck,
  X
} from "lucide-react";
import { useCloudShieldData } from "../../lib/client-api";
import { LogoutButton } from "./logout-button";
import { RouteIcon } from "./route-views";

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

  const visibleGroups = useMemo(() => {
    return navGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, user?.role)) }))
      .filter((group) => group.items.length);
  }, [user?.role]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const links = navGroups.flatMap((group) => group.items.map((item) => item.href));
    links.forEach((href) => router.prefetch(href));
  }, [router]);

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
            <button className="portal-icon-button portal-mobile-menu" onClick={() => setMobileOpen(true)} type="button" aria-label="Open navigation">
              <Menu size={18} />
            </button>
            <label className="portal-search">
              <Search size={15} />
              <input placeholder="Search resources, accounts, findings" type="search" />
              <kbd><Command size={11} />K</kbd>
            </label>
          </div>
          <div className="portal-topbar-right">
            <button className="portal-icon-button" type="button" aria-label="Notifications">
              <Bell size={17} />
            </button>
            <button className="portal-icon-button" type="button" aria-label="Help">
              <HelpCircle size={17} />
            </button>
            <div className="portal-user">
              <span>{(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{user?.name ?? "Workspace user"}</strong>
                <p>{user?.organizationName ?? user?.role ?? "CloudShield"}</p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="portal-content">{children}</main>
      </div>
    </div>
  );
}
