import { BarChart3, FileCheck2, ShieldCheck, WalletCards } from "lucide-react";
import { DashboardPage } from "./shared";

const metrics = [
  { label: "Security score", value: "Foundation", icon: ShieldCheck },
  { label: "Cost score", value: "Foundation", icon: WalletCards },
  { label: "Compliance score", value: "Foundation", icon: FileCheck2 },
  { label: "Reports", value: "JSON planned", icon: BarChart3 }
];

export default function DashboardHome() {
  return (
    <DashboardPage
      title="Executive Cloud Posture"
      description="Foundation shell for account coverage, risk trends, evidence readiness, and cost governance."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="rounded-md border border-line bg-white p-5" key={metric.label}>
              <Icon className="text-signal" size={22} />
              <p className="mt-4 text-sm text-slate-500">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{metric.value}</p>
            </div>
          );
        })}
      </div>
    </DashboardPage>
  );
}
