import { LayoutDashboard, Network, ShieldAlert, FileText, ClipboardCheck, BellRing, ChevronRight } from "lucide-react";

export function CommandCenterPreview() {
  return (
    <div className="relative mx-auto w-full max-w-5xl rounded-xl border border-white/10 bg-[#0d1320] shadow-2xl overflow-hidden transform hover:-translate-y-1 transition-transform duration-500">
      
      {/* OS Mac-style Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#121a2b]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
        </div>
        <div className="flex-1 text-center text-xs font-semibold text-gray-500 tracking-widest uppercase">
          CloudShield Enterprise Command Center
        </div>
      </div>

      <div className="flex flex-col md:flex-row h-[420px]">
        {/* Sidebar */}
        <div className="hidden md:flex flex-col w-48 bg-[#05070d] border-r border-white/5 p-3 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-[#ec7211] bg-[#ec7211]/10 rounded-md">
            <LayoutDashboard size={16} /> Posture
          </div>
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Network size={16} /> Inventory
          </div>
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <ShieldAlert size={16} /> Findings
          </div>
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <ClipboardCheck size={16} /> Governance
          </div>
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <FileText size={16} /> Evidence
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 bg-[#0d1320] flex flex-col gap-6 overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Global Posture</h3>
              <p className="text-sm text-gray-400 mt-1">Aggregated readiness across 24 connected AWS accounts.</p>
            </div>
            <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-md text-xs font-bold uppercase tracking-wide">
              Sync Active
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-[#121a2b] rounded-lg border border-white/5 shadow-inner">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Posture Score</div>
              <div className="text-3xl font-extrabold text-white">86<span className="text-sm text-green-400 font-bold ml-1">/100</span></div>
              <div className="w-full h-1.5 bg-[#05070d] rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#3b82f6] to-[#10b981] w-[86%] rounded-full"></div>
              </div>
            </div>
            <div className="p-4 bg-[#121a2b] rounded-lg border border-white/5 shadow-inner">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Critical Findings</div>
              <div className="text-3xl font-extrabold text-white">12</div>
              <div className="flex gap-1 w-full h-1.5 mt-3">
                <div className="h-full bg-red-500 rounded-full w-[20%]"></div>
                <div className="h-full bg-orange-500 rounded-full w-[30%]"></div>
                <div className="h-full bg-green-500 rounded-full w-[50%]"></div>
              </div>
            </div>
            <div className="p-4 bg-[#121a2b] rounded-lg border border-white/5 shadow-inner">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Scan Activity</div>
              <div className="text-3xl font-extrabold text-white">1.4k</div>
              <div className="flex items-end gap-1 h-3 mt-3">
                {[4, 8, 5, 10, 6, 12, 8, 10].map((h, i) => (
                  <div key={i} className={`flex-1 rounded-sm ${i === 7 ? 'bg-[#3b82f6]' : 'bg-gray-700'}`} style={{ height: `${h}px` }}></div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 bg-[#121a2b] rounded-lg border border-white/5 p-4 flex flex-col shadow-inner">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-white">Recent Operational Timeline</span>
              <span className="text-xs font-bold text-[#ec7211] cursor-pointer flex items-center">View all <ChevronRight size={14} className="ml-0.5" /></span>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: "IAM Role Over-privileged", status: "Open", color: "bg-red-500" },
                { label: "S3 Bucket Public Access", status: "Resolved", color: "bg-green-500" },
                { label: "Unencrypted EBS Volume", status: "Review", color: "bg-orange-500" }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#05070d]/50 rounded-md">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                    <span className="text-sm font-medium text-gray-200">{item.label}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-500">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
