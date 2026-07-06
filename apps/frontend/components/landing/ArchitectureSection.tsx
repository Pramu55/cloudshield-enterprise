import { Cloud, Search, Cpu, CheckCircle2, FileText, BarChart, Monitor } from "lucide-react";

export function ArchitectureSection() {
  const nodes = [
    { label: "AWS", icon: Cloud, color: "text-[#ec7211]", bg: "bg-[#ec7211]/10", border: "border-[#ec7211]/20" },
    { label: "Readonly Inventory", icon: Search, color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10", border: "border-[#3b82f6]/20" },
    { label: "Analysis", icon: Cpu, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { label: "Governance Engine", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
    { label: "Evidence", icon: FileText, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    { label: "Reports", icon: BarChart, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
    { label: "Dashboard", icon: Monitor, color: "text-white", bg: "bg-white/10", border: "border-white/20" }
  ];

  return (
    <section id="architecture" className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Architecture</h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          Built on a reliable, isolated architecture using modern web technologies and secure AWS STS trust.
        </p>
      </div>

      <div className="relative p-8 md:p-12 rounded-2xl bg-[#121a2b] border border-white/5 shadow-2xl overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[100px] bg-[#ec7211]/10 blur-[80px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            return (
              <div key={index} className="flex flex-col md:flex-row items-center w-full md:w-auto">
                <div className={`flex flex-col items-center justify-center p-4 md:w-32 h-32 rounded-xl bg-[#05070d] border ${node.border} shadow-lg transition-transform hover:-translate-y-1`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${node.bg} ${node.color} mb-3`}>
                    <Icon size={20} />
                  </div>
                  <span className="text-gray-300 text-xs font-semibold text-center leading-tight">{node.label}</span>
                </div>
                
                {index < nodes.length - 1 && (
                  <div className="flex justify-center items-center h-8 md:h-auto md:w-8 py-2 md:py-0">
                    <div className="w-0.5 h-full md:w-full md:h-0.5 bg-gradient-to-b md:bg-gradient-to-r from-white/20 to-white/5"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
