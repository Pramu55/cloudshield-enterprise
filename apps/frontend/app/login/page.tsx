import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="portal-auth flex min-h-screen items-center justify-center px-6">
      <section className="portal-auth-card w-full max-w-md rounded-md border border-line bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="cs-action-primary flex h-10 w-10 items-center justify-center rounded-md">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">CloudShield</h1>
            <p className="text-sm text-slate-600">Cloud governance portal</p>
          </div>
        </div>
        <LoginForm />
        <div className="mt-5 border-t border-line pt-4 text-sm text-slate-600">
          New evaluator?{" "}
          <Link className="font-semibold text-signal" href="/register">
            Create an account
          </Link>
        </div>
      </section>
    </main>
  );
}
