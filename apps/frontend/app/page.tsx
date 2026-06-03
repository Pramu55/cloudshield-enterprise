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
  Terminal,
  Activity,
  Zap,
  ChevronRight,
  Code2,
  Cpu,
  LayoutDashboard
} from "lucide-react";
import { PLATFORM_TITLE } from "@cloudshield/contracts";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0B] font-sans text-slate-300 selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
      
      {/* CSS-Only Noise Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-900/10 blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0A0A0B]/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="group flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-teal-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-transform group-hover:scale-105">
                <Shield size={18} fill="currentColor" className="text-white/90" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                CloudShield
              </span>
            </Link>
            <div className="hidden items-center gap-1 text-sm font-medium lg:flex">
              <a href="#product" className="px-3 py-2 text-slate-400 transition-colors hover:text-white">Product</a>
              <a href="#platform" className="px-3 py-2 text-slate-400 transition-colors hover:text-white">Platform</a>
              <a href="#security" className="px-3 py-2 text-slate-400 transition-colors hover:text-white">Security</a>
              <a href="#governance" className="px-3 py-2 text-slate-400 transition-colors hover:text-white">Governance</a>
              <a href="#compliance" className="px-3 py-2 text-slate-400 transition-colors hover:text-white">Compliance</a>
              <a href="#reports" className="px-3 py-2 text-slate-400 transition-colors hover:text-white">Reports</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/register"
              className="hidden text-sm font-medium text-slate-300 transition-colors hover:text-white sm:block"
            >
              Request Workspace
            </Link>
            <Link
              href="/login"
              className="group relative inline-flex h-9 items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-5 text-sm font-semibold text-black transition-all hover:scale-105 hover:bg-slate-200"
            >
              <span>Open Console</span>
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-24 lg:pt-48 lg:pb-32 border-b border-white/5">
        <div className="mx-auto max-w-7xl px-6 text-center">
          
          <div className="mx-auto mb-8 flex max-w-fit items-center justify-center space-x-2 overflow-hidden rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 backdrop-blur-md">
            <AlertTriangle size={14} className="text-indigo-400" />
            <span className="text-xs font-medium text-indigo-200">Local evaluation mode &middot; AWS execution disabled by default &middot; No automatic remediation</span>
          </div>
          
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            CloudShield Enterprise
          </h1>
          
          <h2 className="mx-auto mt-6 max-w-5xl text-xl font-medium text-slate-300 sm:text-2xl lg:text-3xl bg-gradient-to-r from-indigo-300 to-teal-300 bg-clip-text text-transparent">
            AWS Security Posture, Compliance Evidence, FinOps & Governed Remediation Platform
          </h2>
          
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-400">
            A production-style cloud governance control plane for multi-account AWS environments, built with account topology, risk workflows, evidence-backed compliance, reporting, and approval-based remediation planning.
          </p>
          
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="group relative flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-8 text-base font-semibold text-black shadow-lg shadow-white/10 transition-all hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-teal-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
              <span className="relative z-10">Open Console</span>
              <ArrowRight size={18} className="relative z-10 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#product"
              className="group flex h-14 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 text-base font-medium text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              <span>View Capabilities</span>
            </a>
          </div>

          {/* Hero Dashboard Mockup (CSS only) */}
          <div className="mx-auto mt-20 max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-[#0A0A0B] shadow-2xl shadow-indigo-500/10 ring-1 ring-white/5">
            <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/[0.02] px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-white/20"></div>
              <div className="h-2.5 w-2.5 rounded-full bg-white/20"></div>
              <div className="h-2.5 w-2.5 rounded-full bg-white/20"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 min-h-[300px]">
              <div className="hidden border-r border-white/5 bg-white/[0.01] p-4 md:block">
                <div className="mb-4 h-6 w-24 rounded bg-white/10"></div>
                <div className="space-y-3">
                  <div className="h-4 w-full rounded bg-white/5"></div>
                  <div className="h-4 w-5/6 rounded bg-white/5"></div>
                  <div className="h-4 w-4/6 rounded bg-white/5"></div>
                </div>
              </div>
              <div className="col-span-3 p-8">
                <div className="mb-8 h-8 w-48 rounded bg-white/10"></div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="h-24 rounded-lg border border-white/5 bg-white/[0.02]"></div>
                  ))}
                </div>
                <div className="mt-6 h-48 w-full rounded-lg border border-white/5 bg-white/[0.02]"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Capability Section */}
      <section id="product" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="mb-16 md:text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Comprehensive Cloud Governance</h2>
          <p className="mt-4 text-lg text-slate-400">Transform raw cloud infrastructure into governed enterprise assets.</p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Layers, title: "Multi-Account AWS Governance", desc: "Manage hundreds of AWS accounts from a single pane of glass without compromising tenant isolation." },
            { icon: Network, title: "Account Topology & BU Mapping", desc: "Contextualize infrastructure by mapping accounts directly to Business Units and Cost Centers." },
            { icon: ShieldCheck, title: "Security Posture Findings", desc: "Continuous monitoring for IAM misconfigurations, open ports, and unencrypted data stores." },
            { icon: FileCheck2, title: "Compliance Evidence Center", desc: "Translate raw configurations into automated evidence for CIS, SOC2, and internal standards." },
            { icon: BarChart3, title: "FinOps & Cost Governance", desc: "Identify orphaned volumes, idle compute, and architectural inefficiencies driving up cloud waste." },
            { icon: Workflow, title: "Governed Remediation Planning", desc: "Propose actionable fixes through a controlled pipeline rather than executing blind automation." },
            { icon: CheckCircle2, title: "Approval Workflow & Audit Trail", desc: "Require explicit sign-offs for high-risk remediations, backed by immutable audit logs." },
            { icon: FileText, title: "Reports & Executive Evidence", desc: "Generate point-in-time posture reports suitable for executives and external auditors." },
          ].map((feature, i) => (
            <div key={i} className="group relative rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10 hover:border-white/20">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                <feature.icon size={24} />
              </div>
              <h3 className="mb-3 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Workflow Section */}
      <section id="platform" className="relative z-10 border-y border-white/5 bg-[#0e0e11] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 md:text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Platform Workflow Architecture</h2>
            <p className="mt-4 text-lg text-slate-400">Read-only scanner readiness and controlled inventory workflows after explicit configuration.</p>
          </div>
          
          <div className="relative mx-auto max-w-5xl">
            {/* Connecting line */}
            <div className="absolute left-6 top-10 bottom-10 w-0.5 bg-gradient-to-b from-indigo-500/50 via-teal-500/50 to-indigo-500/50 md:left-1/2 md:-translate-x-1/2" />
            
            <div className="space-y-12">
              {[
                { title: "AWS Accounts", icon: Cloud, desc: "Source of truth for cloud resources." },
                { title: "Account Registry", icon: Layers, desc: "Business unit and criticality mapping." },
                { title: "Inventory Sync Readiness", icon: Activity, desc: "Secure AssumeRole read-only polling." },
                { title: "CloudShield DB", icon: Database, desc: "Normalized Postgres relational storage." },
                { title: "Security Rules", icon: ShieldCheck, desc: "Policy evaluation against synced data." },
                { title: "Risk Workflow", icon: AlertTriangle, desc: "Triage and prioritization of findings." },
                { title: "Governance Approval", icon: CheckCircle2, desc: "Review and sign-off on remediation." },
                { title: "Reports", icon: BarChart3, desc: "Executive evidence generation." },
              ].map((step, i) => (
                <div key={i} className={`relative flex items-center ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-8 md:justify-center`}>
                  
                  {/* Content Box */}
                  <div className={`ml-16 w-full md:ml-0 md:w-5/12 ${i % 2 === 0 ? 'md:text-right' : 'md:text-left'}`}>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors hover:bg-white/10 hover:border-indigo-500/30">
                      <h3 className="text-lg font-bold text-white">{step.title}</h3>
                      <p className="mt-2 text-sm text-slate-400">{step.desc}</p>
                    </div>
                  </div>
                  
                  {/* Icon Node */}
                  <div className="absolute left-0 flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#0e0e11] bg-indigo-500 text-white md:relative md:left-auto">
                    <step.icon size={20} />
                  </div>
                  
                  {/* Spacer for alternating layout */}
                  <div className="hidden w-5/12 md:block"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tech Credibility & Enterprise Readiness (Split Section) */}
      <section id="governance" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-16 lg:grid-cols-2">
          
          {/* Tech Credibility */}
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
                <Code2 size={20} />
              </div>
              <h2 className="text-2xl font-bold text-white">Engineering Architecture</h2>
            </div>
            <p className="mb-8 text-slate-400">
              Built as a modern, robust platform utilizing a production-ready technology stack.
            </p>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                "Next.js App Router Frontend",
                "Fastify + Zod Backend API",
                "PostgreSQL + Prisma ORM",
                "Redis + BullMQ Worker Foundation",
                "Docker Local Runtime",
                "Strict Zod Data Contracts",
                "Multi-Account Governance Model",
                "Audit-Safe Workflow Design",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-3 text-sm font-medium text-slate-300">
                  <Cpu size={16} className="text-blue-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Enterprise Readiness */}
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20">
                <Briefcase size={20} />
              </div>
              <h2 className="text-2xl font-bold text-white">Enterprise Readiness</h2>
            </div>
            <p className="mb-8 text-slate-400">
              Designed from the ground up to support the scale and complexity of company IT-level operations.
            </p>
            <ul className="space-y-4">
              {[
                "Multi-account operating model designed for AWS Organizations.",
                "Business unit and cost center metadata mappings.",
                "Criticality and environment (Prod/Non-Prod) segmentation.",
                "Approval-based remediation workflows enforcing four-eyes principles.",
                "Evidence-backed risk closure with historical tracking.",
                "Production deployment roadmap and containerized delivery.",
              ].map((item, i) => (
                <li key={i} className="flex gap-4">
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-400">
                    <CheckCircle2 size={12} />
                  </div>
                  <span className="text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Safety and Trust & Demo Transparency */}
      <section id="security" className="relative z-10 border-y border-white/5 bg-[#0e0e11] py-24">
        <div className="mx-auto max-w-7xl px-6 grid gap-16 lg:grid-cols-2">
          
          {/* Trust Boundaries */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-3">
              <ShieldCheck size={28} className="text-red-400" />
              <h3 className="text-2xl font-bold text-white">Strict Safety Boundaries</h3>
            </div>
            <ul className="space-y-4">
              {[
                "Credentials are environment-only. No AWS keys are stored in the database.",
                "AWS mutation is globally disabled.",
                "Terraform apply is strictly disabled.",
                "Automatic remediation is disabled. Advisory-only mode.",
                "Compliance is CIS/SOC2-inspired, not an official certification.",
                "No real client or Accenture deployment claims are made.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Lock size={18} className="mt-0.5 shrink-0 text-red-400" />
                  <span className="text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Demo Transparency */}
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-8 backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-3">
              <Terminal size={28} className="text-indigo-400" />
              <h3 className="text-2xl font-bold text-white">Portfolio Transparency</h3>
            </div>
            <p className="text-slate-300 mb-6 leading-relaxed">
              Built as a production-style portfolio platform demonstrating deep engineering competency across the entire stack.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                "Cloud Governance Architecture",
                "Backend / API Design",
                "Frontend Product Engineering",
                "Database Modeling",
                "Worker / Scanner Foundation",
                "Approval Workflows",
                "Compliance Evidence",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 rounded bg-white/5 px-3 py-2 text-xs font-medium text-slate-300">
                  <ChevronRight size={14} className="text-indigo-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative z-10 py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-400 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
              <Shield size={32} className="text-white" />
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white sm:text-5xl mb-6">Enter the Workspace</h2>
          <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
            Experience the full governance control plane in a local, read-only evaluation environment.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="group flex h-14 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-white px-8 font-semibold text-black transition-all hover:scale-105"
            >
              Open CloudShield Console <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/register"
              className="flex h-14 w-full sm:w-auto items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 font-semibold text-white transition-colors hover:bg-white/10 hover:border-white/30"
            >
              Create Evaluation Workspace
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#0A0A0B] py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-indigo-400" />
            <span className="font-semibold text-white">{PLATFORM_TITLE}</span>
          </div>
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} CloudShield Enterprise. Local evaluation mode.
          </p>
          <div className="flex gap-6 text-sm text-slate-500">
            <span>Built for scale</span>
            <span>Secure by design</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
