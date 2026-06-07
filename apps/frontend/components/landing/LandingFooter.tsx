import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="premium-footer">
      <div className="premium-container">
        <div className="premium-footer-grid">
          <div>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", color: "#f8fafc", textDecoration: "none", fontWeight: 800, marginBottom: "16px" }}>
              <span style={{ display: "grid", placeItems: "center", width: "28px", height: "28px", borderRadius: "6px", background: "linear-gradient(135deg, #1e293b, #0f172a)", border: "1px solid rgba(255,255,255,0.1)", color: "#ec7211" }}>
                <ShieldCheck size={16} />
              </span>
              <span>CloudShield</span>
            </Link>
            <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.6, maxWidth: "280px" }}>
              Enterprise cloud security console. Read-only discovery, evidence-backed posture, and governed workflows.
            </p>
          </div>
          <div>
            <h4>Platform</h4>
            <ul>
              <li><a href="#platform">AWS Registry</a></li>
              <li><a href="#platform">Inventory</a></li>
              <li><a href="#security">Security Posture</a></li>
              <li><a href="#governance">Resource Graph</a></li>
            </ul>
          </div>
          <div>
            <h4>Solutions</h4>
            <ul>
              <li><a href="#compliance">Compliance</a></li>
              <li><a href="#governance">Cost Governance</a></li>
              <li><a href="#architecture">Architecture</a></li>
              <li><a href="#security">Operations</a></li>
            </ul>
          </div>
          <div>
            <h4>Workspace</h4>
            <ul>
              <li><Link href="/login">Sign in</Link></li>
              <li><Link href="/register">Create workspace</Link></li>
              <li><Link href="/login">Open console</Link></li>
            </ul>
          </div>
        </div>
        <div style={{ marginTop: "80px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "12px" }}>
          <span>&copy; {new Date().getFullYear()} CloudShield Enterprise Platform.</span>
          <span>Illustrative Interface Preview</span>
        </div>
      </div>
    </footer>
  );
}
