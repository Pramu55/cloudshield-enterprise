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
    <nav className={`premium-nav sticky top-0 z-50 flex items-center justify-between transition-all duration-200 ${scrolled ? "bg-[#020617]/90 backdrop-blur-md border-b border-slate-800" : "bg-transparent"}`} aria-label="Primary navigation">
      <div className="flex items-center w-1/3">
        <Link href="/" className="premium-brand flex items-center gap-3 text-white no-underline">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 text-orange-500">
            <ShieldCheck size={18} />
          </span>
          <strong className="text-xl tracking-tight font-extrabold text-white">CloudShield</strong>
        </Link>
      </div>
      
      <div className="premium-nav-links hidden md:flex items-center justify-center w-1/3 gap-8">
        <a href="#platform" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">Platform</a>
        <a href="#security" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">Security</a>
        <a href="#governance" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">Governance</a>
        <a href="#compliance" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">Compliance</a>
      </div>

      <div className="premium-nav-actions flex items-center justify-end w-1/3 gap-4">
        <div className="hidden sm:flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 rounded-lg font-bold text-sm text-slate-200 border border-slate-600 hover:border-slate-400 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link href="/register" className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(234,88,12,0.3)] transition-colors border border-orange-500">
            Create workspace
          </Link>
        </div>
        <button className="md:hidden bg-transparent border-none text-white p-2">
          <Menu size={24} />
        </button>
      </div>
    </nav>
  );
}
