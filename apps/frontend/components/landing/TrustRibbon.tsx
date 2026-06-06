import { DatabaseZap, ShieldCheck, Layers3, Activity } from "lucide-react";

export function TrustRibbon() {
  return (
    <section className="premium-trust-ribbon">
      <div className="premium-container premium-trust-content">
        <div className="premium-trust-item">
          <DatabaseZap size={18} color="#94a3b8" />
          <span>Read-only AWS Connectivity</span>
        </div>
        <div className="premium-trust-item">
          <Layers3 size={18} color="#94a3b8" />
          <span>Strict Tenant Isolation</span>
        </div>
        <div className="premium-trust-item">
          <ShieldCheck size={18} color="#94a3b8" />
          <span>Evidence-backed Posture</span>
        </div>
        <div className="premium-trust-item">
          <Activity size={18} color="#94a3b8" />
          <span>No Autonomous Mutation</span>
        </div>
      </div>
    </section>
  );
}
