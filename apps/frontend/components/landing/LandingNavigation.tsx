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
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300 ${
        scrolled ? "bg-[#05070d]/90 backdrop-blur-md border-b border-white/5" : "bg-transparent"
      }`}
      aria-label="Primary navigation"
    >
      <Link href="/" className="flex items-center gap-3 text-white no-underline hover:opacity-90 transition-opacity">
        <span className="grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br from-[#121a2b] to-[#0d1320] border border-white/10 text-[#ec7211] shadow-[0_0_15px_rgba(236,114,17,0.15)]">
          <ShieldCheck size={20} />
        </span>
        <strong className="text-xl font-bold tracking-tight">CloudShield</strong>
      </Link>

      <div className="hidden md:flex items-center gap-8">
        <a href="#platform" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Platform</a>
        <a href="#security" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Security</a>
        <a href="#governance" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Governance</a>
        <a href="#compliance" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Compliance</a>
        <a href="#architecture" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Architecture</a>
        <a href="#pricing" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Pricing</a>
      </div>

      <div className="hidden md:flex items-center gap-5">
        <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
          Sign in
        </Link>
        <Link 
          href="/register" 
          className="relative inline-flex items-center justify-center h-10 px-6 text-sm font-semibold text-white transition-all bg-[#ec7211] rounded-lg hover:bg-[#d8660f] shadow-[0_0_20px_rgba(236,114,17,0.3)] hover:shadow-[0_0_25px_rgba(236,114,17,0.5)]"
        >
          Create Workspace
        </Link>
      </div>

      <button className="md:hidden flex text-gray-300 hover:text-white">
        <Menu size={24} />
      </button>
    </nav>
  );
}
