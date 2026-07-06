import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function FinalCta() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-24 pb-32">
      <div className="relative p-12 md:p-20 text-center rounded-3xl overflow-hidden bg-gradient-to-br from-[#121a2b] to-[#05070d] border border-white/5 shadow-2xl">
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#ec7211]/10 blur-[100px] pointer-events-none rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#3b82f6]/10 blur-[100px] pointer-events-none rounded-full"></div>

        <div className="relative z-10">
          <div className="inline-flex p-4 rounded-2xl bg-white/5 border border-white/10 mb-8 shadow-inner">
            <ShieldCheck size={36} className="text-[#ec7211]" />
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-6">
            Take control of your cloud posture.
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Deploy the definitive cloud security workspace and unify your inventory, findings, and compliance evidence today.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
        </div>
      </div>
    </section>
  );
}
