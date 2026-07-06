import { KeyRound, Search, Activity, UserCheck, BarChart3, ShieldCheck, ChevronRight } from "lucide-react";

export function WorkflowSection() {
  const steps = [
    { icon: KeyRound, label: "Connect", color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10", border: "border-[#3b82f6]/20" },
    { icon: Search, label: "Discover", color: "text-[#818cf8]", bg: "bg-[#818cf8]/10", border: "border-[#818cf8]/20" },
    { icon: Activity, label: "Analyze", color: "text-[#ec7211]", bg: "bg-[#ec7211]/10", border: "border-[#ec7211]/20" },
    { icon: UserCheck, label: "Govern", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { icon: BarChart3, label: "Report", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
    { icon: ShieldCheck, label: "Evidence", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" }
  ];

  return (
    <section id="governance" className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-20">
        <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Connected Operational Workflow</h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          From AWS read-only discovery to governed remediation and evidence generation, experience a sophisticated security pipeline.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={index} className="flex items-center gap-4 md:gap-6 group">
              <div className={`relative p-6 bg-[#121a2b] border ${step.border} rounded-xl flex flex-col items-center w-32 md:w-40 shadow-xl transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl`}>
                <span className={`grid place-items-center w-12 h-12 rounded-full ${step.bg} ${step.color} mb-4`}>
                  <Icon size={24} />
                </span>
                <span className="text-white text-sm md:text-base font-semibold text-center">{step.label}</span>
                
                {/* Subtle bottom glow indicator */}
                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 rounded-t-full opacity-50 ${step.bg}`}></div>
              </div>
              
              {index < steps.length - 1 && (
                <div className="hidden lg:flex items-center text-gray-600">
                  <ChevronRight size={32} className="opacity-50" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
