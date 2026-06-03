import type { ReactNode } from "react";

type DashboardPageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function DashboardPage({
  title,
  description,
  children
}: DashboardPageProps) {
  return (
    <div className="portal-page">
      <div className="mb-5 border-b border-line pb-4">
        <h2 className="portal-page-title">{title}</h2>
        <p className="portal-page-description mt-1">
          {description}
        </p>
      </div>
      {children || <FoundationPanel />}
    </div>
  );
}

export function FoundationPanel() {
  return (
    <section className="portal-blade rounded-md border border-line bg-white p-6">
      <p className="text-sm font-semibold text-ink">Enterprise governance workspace</p>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        This page is prepared for CloudShield enterprise cloud governance workflows.
        Current modules use typed contracts, tenant-scoped APIs, sample/demo data,
        and safe read-only positioning before AWS inventory scanners are introduced.
      </p>
    </section>
  );
}
