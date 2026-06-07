import { LayoutDashboard, Network, ShieldAlert, FileText, ClipboardCheck, BellRing } from "lucide-react";

export function CommandCenterPreview() {
  return (
    <div className="premium-preview-wrapper animate-float">
      <div className="premium-preview-header">
        <div style={{ display: "flex", gap: "6px" }}>
          <span className="premium-preview-dot" style={{ background: "#ef4444" }} />
          <span className="premium-preview-dot" style={{ background: "#f59e0b" }} />
          <span className="premium-preview-dot" style={{ background: "#10b981" }} />
        </div>
        <div style={{ flex: 1, textAlign: "center", color: "#94a3b8", fontSize: "11px", fontWeight: 600 }}>
          ILLUSTRATIVE PLATFORM PREVIEW - NOT LIVE DATA
        </div>
      </div>
      <div className="premium-preview-body">
        <div className="premium-preview-nav">
          <div className="premium-preview-nav-item active" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 10px", color: "#38bdf8", fontSize: "12px", fontWeight: 700 }}>
            <LayoutDashboard size={14} /> Posture
          </div>
          <div className="premium-preview-nav-item" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 10px", color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>
            <Network size={14} /> Inventory
          </div>
          <div className="premium-preview-nav-item" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 10px", color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>
            <ShieldAlert size={14} /> Findings
          </div>
          <div className="premium-preview-nav-item" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 10px", color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>
            <ClipboardCheck size={14} /> Governance
          </div>
          <div className="premium-preview-nav-item" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 10px", color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>
            <FileText size={14} /> Evidence
          </div>
        </div>
        <div className="premium-preview-main">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "20px", fontWeight: 700 }}>Global Posture</h3>
              <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "13px" }}>Aggregated readiness across 24 connected AWS accounts.</p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ padding: "6px 12px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", color: "#10b981", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>Sync Active</div>
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            <div style={{ padding: "16px", background: "rgba(30, 41, 59, 0.6)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, textTransform: "uppercase" }}>Posture Score</div>
              <div style={{ marginTop: "8px", color: "#f8fafc", fontSize: "28px", fontWeight: 800 }}>86<span style={{ fontSize: "14px", color: "#10b981" }}>/100</span></div>
              <div style={{ marginTop: "12px", height: "4px", background: "#1e293b", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: "86%", height: "100%", background: "linear-gradient(90deg, #38bdf8, #10b981)" }}></div>
              </div>
            </div>
            <div style={{ padding: "16px", background: "rgba(30, 41, 59, 0.6)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, textTransform: "uppercase" }}>Critical Findings</div>
              <div style={{ marginTop: "8px", color: "#f8fafc", fontSize: "28px", fontWeight: 800 }}>12</div>
              <div style={{ marginTop: "12px", display: "flex", gap: "4px" }}>
                <div style={{ width: "20%", height: "4px", background: "#ef4444", borderRadius: "2px" }}></div>
                <div style={{ width: "30%", height: "4px", background: "#f59e0b", borderRadius: "2px" }}></div>
                <div style={{ width: "50%", height: "4px", background: "#10b981", borderRadius: "2px" }}></div>
              </div>
            </div>
            <div style={{ padding: "16px", background: "rgba(30, 41, 59, 0.6)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, textTransform: "uppercase" }}>Scan Activity</div>
              <div style={{ marginTop: "8px", color: "#f8fafc", fontSize: "28px", fontWeight: 800 }}>1.4k</div>
              <div style={{ marginTop: "12px", display: "flex", gap: "4px", alignItems: "flex-end", height: "12px" }}>
                {[4, 8, 5, 10, 6, 12, 8, 10].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}px`, background: i === 7 ? "#38bdf8" : "#334155", borderRadius: "1px" }}></div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: "16px", background: "rgba(30, 41, 59, 0.6)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)", flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <span style={{ color: "#f8fafc", fontSize: "14px", fontWeight: 600 }}>Recent Operational Timeline</span>
              <span style={{ color: "#38bdf8", fontSize: "12px", fontWeight: 600 }}>View all</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { label: "IAM Role Over-privileged", status: "Open", color: "#ef4444" },
                { label: "S3 Bucket Public Access", status: "Resolved", color: "#10b981" },
                { label: "Unencrypted EBS Volume", status: "Review", color: "#f59e0b" }
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "rgba(15, 23, 42, 0.5)", borderRadius: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color }}></div>
                    <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 500 }}>{item.label}</span>
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: "12px" }}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
