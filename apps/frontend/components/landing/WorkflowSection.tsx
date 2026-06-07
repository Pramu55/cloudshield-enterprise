import { KeyRound, Search, ShieldCheck, UserCheck, CheckCircle, ArrowRight } from "lucide-react";

export function WorkflowSection() {
  const steps = [
    { icon: KeyRound, label: "Connect account", color: "#38bdf8" },
    { icon: Search, label: "Evaluate posture", color: "#818cf8" },
    { icon: UserCheck, label: "Assign ownership", color: "#a78bfa" },
    { icon: CheckCircle, label: "Plan action", color: "#10b981" }
  ];

  return (
    <section id="security" className="premium-container" style={{ padding: "80px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: "60px" }}>
        <h2 className="premium-section-title">Connected Operational Workflow</h2>
        <p className="premium-section-subtitle" style={{ margin: "0 auto" }}>
          From AWS read-only discovery to governed remediation, experience a sophisticated security pipeline.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "20px" }}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={index} style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ padding: "20px", background: "rgba(15, 23, 42, 0.4)", border: `1px solid ${step.color}40`, borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", width: "160px" }}>
                <span style={{ display: "grid", placeItems: "center", width: "48px", height: "48px", borderRadius: "50%", background: `${step.color}15`, color: step.color, marginBottom: "16px", boxShadow: `0 0 20px ${step.color}20` }}>
                  <Icon size={24} />
                </span>
                <span style={{ color: "#f8fafc", fontSize: "14px", fontWeight: 600, textAlign: "center" }}>{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div style={{ display: "flex", alignItems: "center", color: "#475569" }}>
                  <div style={{ width: "40px", height: "2px", background: "linear-gradient(90deg, #475569, #94a3b8)", position: "relative" }}>
                    <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: "8px", height: "8px", borderRadius: "50%", background: "#94a3b8" }}></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
