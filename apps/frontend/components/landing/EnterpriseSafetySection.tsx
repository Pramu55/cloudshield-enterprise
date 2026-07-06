import { Shield, Lock, FileCheck, CheckCircle2 } from "lucide-react";

export function EnterpriseSafetySection() {
  return (
    <section id="compliance" className="max-w-7xl mx-auto px-6 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div>
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6">Enterprise Operating Model</h2>
          <p className="text-lg text-gray-400 mb-8 max-w-xl leading-relaxed">
            Safety and governance are built into the architecture. CloudShield requires explicit approval and explicit ownership, serving as a trusted platform for enterprise teams.
          </p>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-[#ec7211]" />
              <span className="text-white font-medium">Built for SOC2 readiness</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-[#ec7211]" />
              <span className="text-white font-medium">Built for ISO27001 readiness</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-[#ec7211]" />
              <span className="text-white font-medium">Evidence-first governance</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex gap-4 p-6 rounded-xl bg-[#121a2b] border border-white/5 shadow-lg">
            <div className="shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
              <Shield size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-2">Readonly inventory</h4>
              <p className="text-gray-400 text-sm leading-relaxed">CloudShield only uses allowlisted Describe and List APIs. No automatic cloud mutation is performed under any circumstances.</p>
            </div>
          </div>
          
          <div className="flex gap-4 p-6 rounded-xl bg-[#121a2b] border border-white/5 shadow-lg">
            <div className="shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-green-500/10 text-green-400">
              <FileCheck size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-2">Governed reporting</h4>
              <p className="text-gray-400 text-sm leading-relaxed">Every recommendation and security finding is paired with the exact API evidence and resource tags, allowing manual audit before any manual change.</p>
            </div>
          </div>
          
          <div className="flex gap-4 p-6 rounded-xl bg-[#121a2b] border border-white/5 shadow-lg">
            <div className="shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
              <Lock size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-2">Strict tenant scoping</h4>
              <p className="text-gray-400 text-sm leading-relaxed">Your AWS data is strictly isolated via Prisma organization boundaries, enforced universally through backend RBAC middleware.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
