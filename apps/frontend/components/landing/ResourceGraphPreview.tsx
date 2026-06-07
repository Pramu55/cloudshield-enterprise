export function ResourceGraphPreview() {
  return (
    <div style={{ position: "absolute", inset: 0, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
          </linearGradient>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Connections */}
        <path d="M 50 100 Q 120 100 150 60" fill="none" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 4" className="premium-dash-anim" />
        <path d="M 50 100 Q 120 100 150 140" fill="none" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 4" className="premium-dash-anim" />
        <path d="M 150 60 Q 220 60 250 100" fill="none" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 4" className="premium-dash-anim" />
        <path d="M 150 140 Q 220 140 250 100" fill="none" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 4" className="premium-dash-anim" />
        <path d="M 250 100 Q 320 100 350 100" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" className="premium-dash-anim-fast" />

        {/* Nodes */}
        <circle cx="50" cy="100" r="24" fill="url(#nodeGlow)" />
        <circle cx="50" cy="100" r="12" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
        <text x="50" y="135" fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="600">AWS Acct</text>

        <circle cx="150" cy="60" r="10" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
        <text x="150" y="40" fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="600">VPC</text>

        <circle cx="150" cy="140" r="10" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
        <text x="150" y="165" fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="600">Subnet</text>

        <circle cx="250" cy="100" r="12" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
        <text x="250" y="130" fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="600">EC2 Instance</text>

        <circle cx="350" cy="100" r="14" fill="#0f172a" stroke="#ef4444" strokeWidth="2" />
        <circle cx="350" cy="100" r="4" fill="#ef4444" />
        <text x="350" y="130" fill="#ef4444" fontSize="10" textAnchor="middle" fontWeight="600">Critical Finding</text>

      </svg>
      <style dangerouslySetInnerHTML={{__html: `
        .premium-dash-anim { animation: premium-dash 2s linear infinite; }
        .premium-dash-anim-fast { animation: premium-dash 1s linear infinite; }
        @keyframes premium-dash { to { stroke-dashoffset: -8; } }
      `}} />
    </div>
  );
}
