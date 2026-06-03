import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Database,
  FileCheck2,
  Network,
  ShieldCheck,
  Shield,
  Layers,
  Lock,
  Workflow,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  FileText,
  Briefcase,
  Server,
  Terminal
} from "lucide-react";
import { PLATFORM_TITLE } from "@cloudshield/contracts";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-panel font-sans text-ink selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-line bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal text-white shadow-sm">
                <Shield size={20} />
              </div>
              <span className="text-xl font-bold tracking-tight text-ink">
                CloudShield
              </span>
            </Link>
            <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
              <a href="#platform" className="hover:text-signal transition-colors">Platform</a>
              <a href="#governance" className="hover:text-signal transition-colors">Governance</a>
              <a href="#security" className="hover:text-signal transition-colors">Security</a>
              <a href="#compliance" className="hover:text-signal transition-colors">Compliance</a>
              <a href="#reports" className="hover:text-signal transition-colors">Reports</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="cs-action-primary inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-all"
            >
              Open Console
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-ink pt-24 pb-32 lg:pt-32 lg:pb-40">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-[25%] -right-[10%] h-[1000px] w-[1000px] rounded-full bg-indigo-900/40 blur-[120px]"></div>
          <div className="absolute bottom-[0%] -left-[10%] h-[800px] w-[800px] rounded-full bg-teal-900/30 blur-[120px]"></div>
        </div>
        
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <div className="status-pill mx-auto mb-8 inline-flex items-center gap-2 border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-200 backdrop-blur-sm">
            <AlertTriangle size={14} className="text-warning" />
            <span>Local evaluation mode &middot; AWS execution disabled by default &middot; No automatic remediation</span>
          </div>
          
          <h1 className="mx-auto max-w-5xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Enterprise AWS Governance, Security Posture, Compliance Evidence & FinOps Control Plane
          </h1>
          
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
            A production-style cloud governance platform for multi-account AWS environments, risk workflows, compliance evidence, governed remediation planning, and executive reporting.
          </p>
          
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="group flex h-12 items-center justify-center gap-2 rounded-lg bg-signal px-8 text-base font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500"
            >
              Open Console <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#platform"
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-8 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-slate-700"
            >
              View Platform Capabilities
            </a>
          </div>
        </div>
      </section>

      {/* Product Value Sections */}
      <section id="platform" className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Platform Capabilities</h2>
          <p className="mt-4 text-lg text-slate-600">Comprehensive governance for complex AWS environments.</p>
        </div>
        
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Layers, title: "Multi-account AWS governance", desc: "Centralized visibility across organization units and sub-accounts." },
            { icon: ShieldCheck, title: "Security posture findings", desc: "Continuous scanning for misconfigurations and vulnerabilities." },
            { icon: FileCheck2, title: "Compliance evidence center", desc: "Automated evidence gathering mapped to compliance frameworks." },
            { icon: BarChart3, title: "FinOps/cost governance", desc: "Visibility into spending anomalies and unoptimized resources." },
            { icon: Workflow, title: "Governed remediation workflows", desc: "Structured approval chains for applying infrastructure fixes." },
            { icon: FileText, title: "Reports and audit evidence", desc: "Executive dashboards and exportable audit trail documentation." },
            { icon: Lock, title: "AWS credential readiness", desc: "Secure handling of access keys, roles, and identity federation." },
            { icon: Network, title: "Read-only STS/inventory readiness", desc: "AssumeRole support with strict read-only boundary policies." },
          ].map((feature, i) => (
            <div key={i} className="premium-card group relative flex flex-col items-start p-6 bg-white">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-panel text-signal transition-colors group-hover:bg-signal group-hover:text-white">
                <feature.icon size={24} />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-ink">{feature.title}</h3>
              <p className="text-sm text-slate-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Architecture */}
      <section id="governance" className="border-y border-line bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Platform Architecture</h2>
            <p className="mt-4 text-lg text-slate-600">Data flow and processing pipeline for cloud governance.</p>
          </div>
          
          <div className="relative mx-auto max-w-5xl">
            {/* Connecting Line (Desktop) */}
            <div className="absolute left-1/2 top-0 bottom-0 hidden w-0.5 -translate-x-1/2 bg-line lg:block"></div>
            
            <div className="flex flex-col gap-8 lg:gap-12">
              {[
                { title: "1. AWS Accounts", icon: Cloud, desc: "Source cloud environments across the organization." },
                { title: "2. Inventory Sync", icon: Database, desc: "Read-only polling of resource configurations and metadata." },
                { title: "3. CloudShield DB", icon: Server, desc: "Normalized relational storage of cloud asset states." },
                { title: "4. Security Rules", icon: Shield, desc: "Evaluation engine applying CIS/SOC2 inspired policies." },
                { title: "5. Risk Workflow", icon: AlertTriangle, desc: "Triaging, severity scoring, and assignment of findings." },
                { title: "6. Governance Approval", icon: CheckCircle2, desc: "Multi-stage review for proposed remediation plans." },
                { title: "7. Reports", icon: BarChart3, desc: "Aggregated views and compliance evidence generation." },
              ].map((step, i) => (
                <div key={i} className={`relative flex flex-col items-center lg:flex-row ${i % 2 === 0 ? 'lg:justify-start' : 'lg:justify-end'}`}>
                  <div className={`w-full lg:w-5/12 ${i % 2 === 0 ? 'lg:text-right lg:pr-12' : 'lg:text-left lg:pl-12 lg:order-last'}`}>
                    <div className="premium-card p-6 bg-white">
                      <h3 className="mb-2 text-lg font-semibold text-ink">{step.title}</h3>
                      <p className="text-sm text-slate-600">{step.desc}</p>
                    </div>
                  </div>
                  
                  {/* Center Node */}
                  <div className="absolute left-1/2 hidden h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-panel text-signal shadow-sm lg:flex">
                    <step.icon size={20} />
                  </div>
                  
                  {/* Mobile Node */}
                  <div className="my-4 flex h-10 w-10 items-center justify-center rounded-full bg-panel text-signal shadow-sm lg:hidden">
                    <step.icon size={18} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Readiness & Safety */}
      <section id="security" className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
        <div className="grid gap-16 lg:grid-cols-2">
          
          {/* Enterprise Readiness */}
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-teal">
                <Briefcase size={20} />
              </div>
              <h2 className="text-2xl font-bold text-ink">Enterprise Readiness</h2>
            </div>
            
            <ul className="space-y-6">
              {[
                { title: "Multi-account operating model", desc: "Built for AWS Organizations scale." },
                { title: "Business unit & cost center mapping", desc: "Attribute-based metadata assignment." },
                { title: "Environment segmentation", desc: "Isolate Prod, Non-Prod, and Sandbox risks." },
                { title: "Approval workflow & Audit trail", desc: "Non-repudiable logs of governance decisions." },
                { title: "Production deployment roadmap", desc: "Designed for scalable containerized deployment." },
              ].map((item, i) => (
                <li key={i} className="flex gap-4">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-teal">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h4 className="font-medium text-ink">{item.title}</h4>
                    <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Safety & Trust */}
          <div id="compliance">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-warning">
                <ShieldCheck size={20} />
              </div>
              <h2 className="text-2xl font-bold text-ink">Safety & Trust Boundaries</h2>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "No credentials stored in database",
                "Environment-only credential model",
                "AWS mutation disabled globally",
                "Terraform apply blocked",
                "Automatic remediation disabled",
                "CIS/SOC2-inspired, no certification claims",
              ].map((item, i) => (
                <div key={i} className="premium-card flex items-start gap-3 p-4 bg-white">
                  <Lock size={18} className="mt-0.5 shrink-0 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </section>

      {/* Demo / Portfolio Section */}
      <section id="reports" className="border-t border-line bg-panel py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Terminal size={32} className="mx-auto mb-4 text-slate-400" />
          <h2 className="text-xl font-semibold text-ink">Portfolio & Demo Project</h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Built as a company IT-level AWS governance platform. Demonstrates backend, frontend, database, worker, governance, and cloud architecture skills. Local evaluation console available through login.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-ink py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-signal opacity-5"></div>
        <div className="relative mx-auto max-w-4xl px-6">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to evaluate CloudShield?</h2>
          <p className="mt-4 text-lg text-slate-300">Experience the governance control plane locally.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="cs-action-primary flex h-12 w-full items-center justify-center gap-2 rounded-lg px-8 text-base font-semibold shadow-sm sm:w-auto"
            >
              Open CloudShield Console
            </Link>
            <Link
              href="/register"
              className="flex h-12 w-full items-center justify-center rounded-lg border border-slate-600 bg-transparent px-8 text-base font-semibold text-white transition-colors hover:bg-slate-800 sm:w-auto"
            >
              Create Evaluation Workspace
            </Link>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-slate-800 bg-ink py-8">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} {PLATFORM_TITLE}. Local evaluation mode.
          </p>
        </div>
      </footer>
    </main>
  );
}
