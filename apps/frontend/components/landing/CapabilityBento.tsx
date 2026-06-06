import { Cloud, Network, ShieldAlert, FileText, ClipboardCheck, BarChart3, Clock, AlertTriangle } from "lucide-react";
import { ResourceGraphPreview } from "./ResourceGraphPreview";

export function CapabilityBento() {
  return (
    <section id="platform" className="premium-container" style={{ padding: "80px 24px" }}>
      <h2 className="premium-section-title">Asymmetric Capabilities</h2>
      <p className="premium-section-subtitle">
        CloudShield brings account registry, resource inventory, security workflow, 
        governance, evidence, and reporting into one high-density operating surface.
      </p>

      <div className="premium-bento-grid">
        {/* Large Feature 1 */}
        <div className="premium-card" style={{ gridColumn: "span 8", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: "24px" }}>
            <span style={{ display: "inline-flex", padding: "6px", borderRadius: "8px", background: "rgba(14, 165, 233, 0.1)", color: "#38bdf8", marginBottom: "12px" }}><Network size={20} /></span>
            <h3 style={{ color: "#f8fafc", fontSize: "20px", fontWeight: 700, margin: 0 }}>Resource Graph</h3>
            <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "8px", lineHeight: 1.5 }}>
              Explore connected topologies across VPCs, subnets, EC2 instances, and security groups in a unified dependency view.
            </p>
          </div>
          <div style={{ flex: 1, minHeight: "220px", background: "rgba(2, 6, 23, 0.4)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
            <ResourceGraphPreview />
          </div>
        </div>

        {/* Feature 2 */}
        <div className="premium-card" style={{ gridColumn: "span 4" }}>
          <span style={{ display: "inline-flex", padding: "6px", borderRadius: "8px", background: "rgba(236, 114, 17, 0.1)", color: "#f97316", marginBottom: "12px" }}><ShieldAlert size={20} /></span>
          <h3 style={{ color: "#f8fafc", fontSize: "20px", fontWeight: 700, margin: 0 }}>Security Posture</h3>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "8px", lineHeight: 1.5 }}>
            Triage findings with severity distribution, ownership assignment, and workflow state.
          </p>
          
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {[{ label: "Critical", count: 12, color: "#ef4444", width: "80%" }, { label: "High", count: 34, color: "#f97316", width: "60%" }, { label: "Medium", count: 89, color: "#eab308", width: "40%" }].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "60px", color: "#94a3b8", fontSize: "12px" }}>{s.label}</div>
                <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                  <div style={{ width: s.width, height: "100%", background: s.color, borderRadius: "3px" }}></div>
                </div>
                <div style={{ width: "24px", textAlign: "right", color: "#f8fafc", fontSize: "12px", fontWeight: 600 }}>{s.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature 3 */}
        <div className="premium-card" style={{ gridColumn: "span 4" }}>
          <span style={{ display: "inline-flex", padding: "6px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", marginBottom: "12px" }}><FileText size={20} /></span>
          <h3 style={{ color: "#f8fafc", fontSize: "20px", fontWeight: 700, margin: 0 }}>Compliance Evidence</h3>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "8px", lineHeight: 1.5 }}>
            Review evidence center records and generate compliance progress paths automatically.
          </p>
          <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative", width: "120px", height: "120px", borderRadius: "50%", background: "conic-gradient(#10b981 0% 75%, rgba(255,255,255,0.05) 75% 100%)", display: "grid", placeItems: "center" }}>
              <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "#0f172a", display: "grid", placeItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#f8fafc", fontSize: "24px", fontWeight: 800 }}>75%</div>
                  <div style={{ color: "#94a3b8", fontSize: "10px", textTransform: "uppercase" }}>Compliant</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 4 */}
        <div className="premium-card" style={{ gridColumn: "span 4" }}>
          <span style={{ display: "inline-flex", padding: "6px", borderRadius: "8px", background: "rgba(139, 92, 246, 0.1)", color: "#a78bfa", marginBottom: "12px" }}><ClipboardCheck size={20} /></span>
          <h3 style={{ color: "#f8fafc", fontSize: "20px", fontWeight: 700, margin: 0 }}>Cost Governance</h3>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "8px", lineHeight: 1.5 }}>
            Track approvals, requested work, and identify cost anomalies with precise intelligence.
          </p>
          <div style={{ marginTop: "32px", display: "flex", alignItems: "flex-end", gap: "6px", height: "60px" }}>
            {[30, 40, 35, 50, 45, 80, 55, 60].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 5 ? "#a78bfa" : "rgba(139, 92, 246, 0.2)", borderRadius: "4px 4px 0 0", transition: "height 0.3s ease" }}></div>
            ))}
          </div>
        </div>

        {/* Feature 5 */}
        <div className="premium-card" style={{ gridColumn: "span 4" }}>
          <span style={{ display: "inline-flex", padding: "6px", borderRadius: "8px", background: "rgba(244, 63, 94, 0.1)", color: "#fb7185", marginBottom: "12px" }}><Cloud size={20} /></span>
          <h3 style={{ color: "#f8fafc", fontSize: "20px", fontWeight: 700, margin: 0 }}>AWS Registry</h3>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "8px", lineHeight: 1.5 }}>
            Manage multiple AWS accounts, validating STS roles and tracking integration freshness in real time.
          </p>
          <div style={{ marginTop: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", background: "rgba(2, 6, 23, 0.5)", borderRadius: "6px", marginBottom: "8px", borderLeft: "2px solid #10b981" }}>
              <span style={{ color: "#e2e8f0", fontSize: "13px" }}>Production AWS</span>
              <span style={{ color: "#10b981", fontSize: "11px", fontWeight: 600 }}>Connected</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", background: "rgba(2, 6, 23, 0.5)", borderRadius: "6px", borderLeft: "2px solid #ef4444" }}>
              <span style={{ color: "#e2e8f0", fontSize: "13px" }}>Staging Environment</span>
              <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: 600 }}>STS Failed</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
