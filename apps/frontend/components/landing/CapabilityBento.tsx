import { Cloud, Network, ShieldAlert, FileText, ClipboardCheck, BarChart3, Clock, AlertTriangle } from "lucide-react";
import { ResourceGraphPreview } from "./ResourceGraphPreview";

export function CapabilityBento() {
  return (
    <section id="platform" className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Asymmetric Capabilities</h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          CloudShield brings account registry, resource inventory, security workflow, 
          governance, evidence, and reporting into one high-density operating surface.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Large Feature 1 */}
        <div className="md:col-span-8 flex flex-col p-8 rounded-2xl bg-[#121a2b] border border-white/5 shadow-2xl hover:border-white/10 transition-colors">
          <div className="mb-6">
            <span className="inline-flex p-2.5 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] mb-4">
              <Network size={24} />
            </span>
            <h3 className="text-2xl font-bold text-white mb-2">Resource Graph</h3>
            <p className="text-gray-400 leading-relaxed max-w-xl">
              Explore connected topologies across VPCs, subnets, EC2 instances, and security groups in a unified dependency view.
            </p>
          </div>
          <div className="flex-1 min-h-[260px] bg-[#05070d]/60 rounded-xl border border-white/5 relative overflow-hidden flex items-center justify-center">
            <ResourceGraphPreview />
          </div>
        </div>

        {/* Feature 2 */}
        <div className="md:col-span-4 p-8 rounded-2xl bg-[#121a2b] border border-white/5 shadow-2xl hover:border-white/10 transition-colors">
          <span className="inline-flex p-2.5 rounded-xl bg-[#ec7211]/10 text-[#ec7211] mb-4">
            <ShieldAlert size={24} />
          </span>
          <h3 className="text-2xl font-bold text-white mb-2">Security Posture</h3>
          <p className="text-gray-400 leading-relaxed mb-6">
            Triage findings with severity distribution, ownership assignment, and workflow state.
          </p>
          
          <div className="flex flex-col gap-3">
            {[
              { label: "Critical", count: 12, color: "bg-red-500", width: "w-[80%]" }, 
              { label: "High", count: 34, color: "bg-[#ec7211]", width: "w-[60%]" }, 
              { label: "Medium", count: 89, color: "bg-yellow-500", width: "w-[40%]" }
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-16 text-xs text-gray-500 uppercase font-semibold">{s.label}</div>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.width} ${s.color}`}></div>
                </div>
                <div className="w-8 text-right text-sm font-bold text-white">{s.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature 3 */}
        <div className="md:col-span-4 p-8 rounded-2xl bg-[#121a2b] border border-white/5 shadow-2xl hover:border-white/10 transition-colors">
          <span className="inline-flex p-2.5 rounded-xl bg-green-500/10 text-green-400 mb-4">
            <FileText size={24} />
          </span>
          <h3 className="text-2xl font-bold text-white mb-2">Compliance Evidence</h3>
          <p className="text-gray-400 leading-relaxed mb-8">
            Review evidence center records and generate compliance progress paths automatically.
          </p>
          <div className="flex justify-center">
            <div className="relative w-32 h-32 rounded-full flex items-center justify-center" style={{ background: "conic-gradient(#10b981 0% 75%, rgba(255,255,255,0.05) 75% 100%)" }}>
              <div className="w-[110px] h-[110px] rounded-full bg-[#121a2b] flex items-center justify-center shadow-inner">
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-white">75%</div>
                  <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Compliant</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 4 */}
        <div className="md:col-span-4 p-8 rounded-2xl bg-[#121a2b] border border-white/5 shadow-2xl hover:border-white/10 transition-colors">
          <span className="inline-flex p-2.5 rounded-xl bg-purple-500/10 text-purple-400 mb-4">
            <ClipboardCheck size={24} />
          </span>
          <h3 className="text-2xl font-bold text-white mb-2">Cost Governance</h3>
          <p className="text-gray-400 leading-relaxed mb-8">
            Track approvals, requested work, and identify cost anomalies with precise intelligence.
          </p>
          <div className="flex items-end gap-2 h-20">
            {[30, 40, 35, 50, 45, 80, 55, 60].map((h, i) => (
              <div key={i} className={`flex-1 rounded-t-sm transition-all duration-300 hover:opacity-100 ${i === 5 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-purple-500/20 opacity-70'}`} style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>

        {/* Feature 5 */}
        <div className="md:col-span-4 p-8 rounded-2xl bg-[#121a2b] border border-white/5 shadow-2xl hover:border-white/10 transition-colors">
          <span className="inline-flex p-2.5 rounded-xl bg-pink-500/10 text-pink-400 mb-4">
            <Cloud size={24} />
          </span>
          <h3 className="text-2xl font-bold text-white mb-2">AWS Registry</h3>
          <p className="text-gray-400 leading-relaxed mb-8">
            Manage multiple AWS accounts, validating STS roles and tracking integration freshness.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#05070d]/50 rounded-lg border-l-2 border-green-500">
              <span className="text-sm font-medium text-gray-200">Production AWS</span>
              <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded">Connected</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#05070d]/50 rounded-lg border-l-2 border-red-500">
              <span className="text-sm font-medium text-gray-200">Staging Environment</span>
              <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">STS Failed</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
