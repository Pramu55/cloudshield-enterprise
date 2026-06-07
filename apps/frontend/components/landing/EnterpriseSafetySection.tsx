import { Shield, Lock, FileCheck } from "lucide-react";

export function EnterpriseSafetySection() {
  return (
    <section id="compliance" className="premium-container" style={{ padding: "60px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "40px" }}>
        <div>
          <h2 className="premium-section-title">Enterprise Operating Model</h2>
          <p className="premium-section-subtitle">
            Safety and governance are built into the architecture. CloudShield requires explicit approval and explicit ownership.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", gap: "16px" }}>
            <span style={{ color: "#38bdf8" }}><Shield size={24} /></span>
            <div>
              <h4 style={{ color: "#f8fafc", fontSize: "16px", fontWeight: 700, margin: 0 }}>Read-only discovery</h4>
              <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5, margin: "8px 0 0" }}>CloudShield only uses allowlisted Describe and List APIs. No automatic cloud mutation is performed under any circumstances.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <span style={{ color: "#10b981" }}><FileCheck size={24} /></span>
            <div>
              <h4 style={{ color: "#f8fafc", fontSize: "16px", fontWeight: 700, margin: 0 }}>Evidence before action</h4>
              <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5, margin: "8px 0 0" }}>Every recommendation and security finding is paired with the exact API evidence and resource tags, allowing manual audit before any manual change.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <span style={{ color: "#a78bfa" }}><Lock size={24} /></span>
            <div>
              <h4 style={{ color: "#f8fafc", fontSize: "16px", fontWeight: 700, margin: 0 }}>Strict tenant scoping</h4>
              <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5, margin: "8px 0 0" }}>Your AWS data is strictly isolated via Prisma organization boundaries, enforced universally through backend RBAC middleware.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
