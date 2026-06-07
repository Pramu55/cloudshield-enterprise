import { Database, Server, Component, Globe } from "lucide-react";

export function ArchitectureSection() {
  return (
    <section id="architecture" className="premium-container" style={{ padding: "80px 24px" }}>
      <h2 className="premium-section-title">Technical Foundation</h2>
      <p className="premium-section-subtitle">
        Built on a reliable, isolated architecture using modern web technologies and secure AWS STS trust.
      </p>

      <div style={{ marginTop: "40px", padding: "40px", background: "rgba(15, 23, 42, 0.4)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", background: "rgba(56, 189, 248, 0.1)", borderRadius: "10px", color: "#38bdf8" }}><Globe size={24} /></div>
          <div>
            <div style={{ color: "#f8fafc", fontSize: "16px", fontWeight: 700 }}>Next.js</div>
            <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>React Server Components</div>
          </div>
        </div>

        <div style={{ width: "1px", background: "rgba(255,255,255,0.1)", minHeight: "40px" }}></div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "10px", color: "#10b981" }}><Server size={24} /></div>
          <div>
            <div style={{ color: "#f8fafc", fontSize: "16px", fontWeight: 700 }}>Fastify Backend</div>
            <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>High-performance APIs</div>
          </div>
        </div>

        <div style={{ width: "1px", background: "rgba(255,255,255,0.1)", minHeight: "40px" }}></div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", background: "rgba(139, 92, 246, 0.1)", borderRadius: "10px", color: "#a78bfa" }}><Database size={24} /></div>
          <div>
            <div style={{ color: "#f8fafc", fontSize: "16px", fontWeight: 700 }}>PostgreSQL & Redis</div>
            <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>Isolated Tenant Data</div>
          </div>
        </div>

        <div style={{ width: "1px", background: "rgba(255,255,255,0.1)", minHeight: "40px" }}></div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", background: "rgba(249, 115, 22, 0.1)", borderRadius: "10px", color: "#f97316" }}><Component size={24} /></div>
          <div>
            <div style={{ color: "#f8fafc", fontSize: "16px", fontWeight: 700 }}>BullMQ Worker</div>
            <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>Async Operations</div>
          </div>
        </div>
      </div>
    </section>
  );
}
