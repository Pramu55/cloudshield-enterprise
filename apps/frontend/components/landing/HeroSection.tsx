import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { CommandCenterPreview } from "./CommandCenterPreview";

export function HeroSection() {
  return (
    <section className="premium-hero">
      <div className="premium-container">
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "999px", background: "rgba(14, 165, 233, 0.1)", border: "1px solid rgba(14, 165, 233, 0.2)", color: "#38bdf8", fontSize: "12px", fontWeight: 700, marginBottom: "24px" }}>
          <Lock size={14} /> Enterprise Cloud Security Console
        </div>

        <h1 className="premium-headline">
          Cloud security, governance and evidence <br />
          <span style={{ color: "#ec7211", background: "transparent", WebkitTextFillColor: "initial", WebkitBackgroundClip: "initial" }}>unified in one command center.</span>
        </h1>

        <p className="premium-subheadline">
          A premium operations workspace for read-only inventory, account posture, security findings, cost governance, compliance evidence, and governed remediation planning.
        </p>

        <div className="premium-hero-actions">
          <Link href="/register" className="premium-btn-primary">
            Create workspace
          </Link>
          <Link href="/login" className="premium-btn-secondary">
            Open console <ArrowRight size={16} />
          </Link>
        </div>

        <CommandCenterPreview />
      </div>
    </section>
  );
}
