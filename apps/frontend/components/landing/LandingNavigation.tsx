"use client";

import Link from "next/link";
import { ShieldCheck, Menu } from "lucide-react";
import { useEffect, useState } from "react";

export function LandingNavigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`premium-nav ${scrolled ? "scrolled" : ""}`} aria-label="Primary navigation">
      <Link href="/" className="premium-brand" style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fff", textDecoration: "none" }}>
        <span style={{ display: "grid", placeItems: "center", width: "34px", height: "34px", borderRadius: "8px", background: "linear-gradient(135deg, #1e293b, #0f172a)", border: "1px solid rgba(255,255,255,0.1)", color: "#ec7211" }}>
          <ShieldCheck size={18} />
        </span>
        <strong style={{ fontSize: "18px", letterSpacing: "-0.02em" }}>CloudShield</strong>
      </Link>

      <div className="premium-nav-links">
        <a href="#platform" className="premium-nav-link">Platform</a>
        <a href="#security" className="premium-nav-link">Security</a>
        <a href="#governance" className="premium-nav-link">Governance</a>
        <a href="#compliance" className="premium-nav-link">Compliance</a>
        <a href="#architecture" className="premium-nav-link">Architecture</a>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }} className="premium-nav-actions">
        <Link href="/login" className="premium-nav-link" style={{ display: "none" /* mobile */ }}>Sign in</Link>
        <div style={{ display: "flex", gap: "12px" }}>
          <Link href="/login" className="premium-btn-secondary" style={{ display: "none" }}>Open console</Link>
          <Link href="/login" className="premium-nav-link">Sign in</Link>
          <Link href="/register" className="premium-btn-primary">Create workspace</Link>
        </div>
        <button className="premium-mobile-menu-btn" style={{ background: "transparent", border: "none", color: "#fff", display: "none" }}>
          <Menu size={24} />
        </button>
      </div>
    </nav>
  );
}
