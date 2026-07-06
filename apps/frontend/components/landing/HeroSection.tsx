import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { CommandCenterPreview } from "./CommandCenterPreview";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden bg-[#05070d]">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#ec7211]/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-[#3b82f6]/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-6 text-center z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#121a2b] border border-white/10 text-[#3b82f6] text-xs font-bold uppercase tracking-wider mb-8 shadow-lg">
          <Lock size={14} className="text-[#3b82f6]" /> Enterprise Cloud Security Console
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
          Cloud security, governance and evidence <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ec7211] to-[#f9a826]">
            unified in one command center.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-400 mb-10 leading-relaxed">
          A premium operations workspace for read-only inventory, account posture, security findings, cost governance, compliance evidence, and governed remediation planning.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Link 
            href="/register" 
            className="flex items-center justify-center w-full sm:w-auto px-8 py-3.5 text-sm font-bold text-white transition-all bg-[#ec7211] rounded-lg hover:bg-[#d8660f] shadow-[0_0_20px_rgba(236,114,17,0.3)] hover:shadow-[0_0_30px_rgba(236,114,17,0.5)]"
          >
            Create Workspace
          </Link>
          <Link 
            href="/login" 
            className="flex items-center justify-center w-full sm:w-auto px-8 py-3.5 text-sm font-semibold text-white transition-all bg-[#121a2b] border border-white/10 rounded-lg hover:bg-[#1a243a] hover:border-white/20"
          >
            Open Console <ArrowRight size={16} className="ml-2" />
          </Link>
        </div>

        <CommandCenterPreview />
      </div>
    </section>
  );
}
