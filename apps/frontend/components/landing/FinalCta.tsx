import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function FinalCta() {
  return (
    <section className="premium-container" style={{ padding: "120px 24px" }}>
      <div style={{ position: "relative", padding: "60px 40px", textAlign: "center", borderRadius: "24px", overflow: "hidden", background: "linear-gradient(135deg, #0f172a, #1e293b)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 40px 100px -20px rgba(0,0,0,0.8)" }}>
        
        {/* Glow Effects */}
        <div style={{ position: "absolute", top: "-50%", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(14, 165, 233, 0.15), transparent 70%)", pointerEvents: "none" }}></div>
        <div style={{ position: "absolute", bottom: "-50%", left: "20%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(236, 114, 17, 0.1), transparent 70%)", pointerEvents: "none" }}></div>

        <div style={{ position: "relative", zIndex: 10 }}>
          <div style={{ display: "inline-flex", padding: "12px", borderRadius: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: "24px" }}>
            <ShieldCheck size={32} color="#38bdf8" />
          </div>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 800, color: "#f8fafc", margin: "0 0 16px" }}>Take control of your cloud posture.</h2>
          <p style={{ color: "#94a3b8", fontSize: "18px", maxWidth: "600px", margin: "0 auto 40px", lineHeight: 1.6 }}>
            Deploy the definitive cloud security workspace and unify your inventory, findings, and compliance evidence today.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <Link href="/register" className="premium-btn-primary" style={{ padding: "0 32px", height: "48px", fontSize: "15px" }}>
              Create workspace
            </Link>
            <Link href="/login" className="premium-btn-secondary" style={{ padding: "0 32px", height: "48px", fontSize: "15px" }}>
              Open console <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
