import { ShieldAlert, BarChart3, FileText, Settings, Activity } from "lucide-react";

export function WorkspaceShowcase() {
  const workspaces = [
    { title: "Security Workspace", desc: "Severity distribution, misconfigurations, and findings queues.", icon: ShieldAlert, color: "#f97316" },
    { title: "FinOps Workspace", desc: "Resource costs, anomalies, and billing optimization context.", icon: BarChart3, color: "#10b981" },
    { title: "Compliance Workspace", desc: "Evidence trails, requirement checks, and exportable PDFs.", icon: FileText, color: "#38bdf8" },
    { title: "Operations", desc: "Region deployment maps, scan schedules, and system health.", icon: Activity, color: "#818cf8" }
  ];

  return (
    <section id="governance" style={{ background: "linear-gradient(180deg, #020617, #0b1120)", padding: "100px 0", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="premium-container">
        <h2 className="premium-section-title" style={{ textAlign: "center" }}>Enterprise Workspaces</h2>
        <p className="premium-section-subtitle" style={{ margin: "0 auto 60px", textAlign: "center" }}>
          Specialized views designed for precise enterprise review and task completion.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
          {workspaces.map((ws, i) => {
            const Icon = ws.icon;
            return (
              <div key={i} className="premium-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ display: "grid", placeItems: "center", width: "40px", height: "40px", borderRadius: "8px", background: `${ws.color}15`, color: ws.color }}>
                    <Icon size={20} />
                  </span>
                  <h3 style={{ color: "#f8fafc", fontSize: "18px", fontWeight: 700, margin: 0 }}>{ws.title}</h3>
                </div>
                <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5, margin: 0 }}>
                  {ws.desc}
                </p>
                <div style={{ marginTop: "16px", height: "120px", background: "rgba(2, 6, 23, 0.5)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", padding: "12px", gap: "8px" }}>
                  <div style={{ width: "30%", background: "rgba(255,255,255,0.02)", borderRadius: "4px" }}></div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ height: "40px", background: "rgba(255,255,255,0.02)", borderRadius: "4px" }}></div>
                    <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", borderRadius: "4px" }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
