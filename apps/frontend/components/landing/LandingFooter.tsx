import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="bg-[#05070d] border-t border-white/5 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8 mb-16">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 text-white no-underline hover:opacity-90 transition-opacity mb-6">
              <span className="grid place-items-center w-8 h-8 rounded-md bg-gradient-to-br from-[#121a2b] to-[#0d1320] border border-white/10 text-[#ec7211]">
                <ShieldCheck size={18} />
              </span>
              <span className="text-lg font-bold tracking-tight">CloudShield</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Enterprise cloud security console. Read-only discovery, evidence-backed posture, and governed workflows.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide text-sm">Platform</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><a href="#platform" className="hover:text-white transition-colors">AWS Registry</a></li>
              <li><a href="#platform" className="hover:text-white transition-colors">Inventory</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">Security Posture</a></li>
              <li><a href="#governance" className="hover:text-white transition-colors">Resource Graph</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide text-sm">Resources</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><a href="#compliance" className="hover:text-white transition-colors">Compliance</a></li>
              <li><a href="#governance" className="hover:text-white transition-colors">Cost Governance</a></li>
              <li><a href="#architecture" className="hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">Support</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide text-sm">Company</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide text-sm">Workspace</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
              <li><Link href="/register" className="hover:text-white transition-colors">Create workspace</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors">Open console</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/5 text-xs text-gray-500 gap-4">
          <div className="flex items-center gap-6">
            <span>&copy; {new Date().getFullYear()} CloudShield Enterprise Platform.</span>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
          <span>Illustrative Interface Preview</span>
        </div>
      </div>
    </footer>
  );
}
