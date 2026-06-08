import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { CommandCenterPreview } from "./CommandCenterPreview";

export function HeroSection() {
  return (
    <section className="premium-hero pt-20 pb-24 px-6 md:px-12 max-w-[1400px] mx-auto w-full relative">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Side: Copy & CTAs */}
        <div className="flex flex-col items-start text-left z-10 pt-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 text-sky-400 text-xs font-bold mb-8 uppercase tracking-widest">
            <Lock size={14} /> Enterprise Cloud Security
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] max-w-xl">
            Cloud security, governance and evidence <span className="text-orange-500">in one command center.</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-lg mb-10 leading-relaxed font-medium">
            A premium operations workspace for read-only inventory, account posture, security findings, cost governance, and automated compliance tracking.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
            <Link href="/login" className="bg-orange-600 hover:bg-orange-500 text-white px-7 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-[15px] shadow-[0_0_20px_rgba(234,88,12,0.4)] border border-orange-500 w-full sm:w-auto">
              Open console <ArrowRight size={18} />
            </Link>
            <Link href="/register" className="bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-600 px-7 py-3.5 rounded-xl font-bold transition-all text-[15px] flex items-center justify-center w-full sm:w-auto">
              Create workspace
            </Link>
          </div>

          <div className="mt-12 flex items-center gap-6 text-sm font-semibold text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> No autonomous mutations
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div> Strict tenant isolation
            </div>
          </div>
        </div>

        {/* Right Side: Illustrative Preview */}
        <div className="relative w-full z-10 mt-10 lg:mt-0">
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 to-orange-500/10 rounded-[24px] blur-3xl -z-10"></div>
          <div className="w-full text-right mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest pr-4">
            Illustrative platform preview — not live AWS data
          </div>
          <div className="rounded-xl border border-slate-700/50 shadow-2xl bg-[#0b1120]/80 backdrop-blur overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
            <CommandCenterPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
