"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, KeyRound, Info } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@cloudshield.local");
  const [password, setPassword] = useState("CloudShieldDemo123!");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Form validations
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid work email.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: email.trim(), password })
      });

      if (response.status === 401) {
        setError("Invalid email or password.");
        return;
      }

      if (!response.ok) {
        setError("Server unavailable. Please try again.");
        return;
      }

      const data = (await response.json()) as {
        accessToken: string;
        user: { email: string };
        organization: { name: string };
      };

      setSuccessMsg("Login successful. Redirecting...");

      localStorage.setItem("cloudshield_access_token", data.accessToken);
      localStorage.setItem(
        "cloudshield_current_user",
        JSON.stringify({
          user: data.user,
          organization: data.organization
        })
      );
      document.cookie = `cloudshield_access_token=${data.accessToken}; path=/; SameSite=Lax; max-age=3600`;
      
      const nextPath = new URLSearchParams(window.location.search).get("next");
      const destination = nextPath?.startsWith("/dashboard")
        ? nextPath
        : "/dashboard";
      
      router.prefetch(destination);
      setTimeout(() => {
        router.replace(destination);
        router.refresh();
      }, 800);
    } catch {
      setError("Server unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="aws-auth-form" onSubmit={onSubmit}>
      <label>
        <span>Work email</span>
        <div>
          <input
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            type="email"
            value={email}
            disabled={isSubmitting}
          />
        </div>
      </label>
      
      <label>
        <span>Password</span>
        <div>
          <input
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
            value={password}
            disabled={isSubmitting}
          />
        </div>
      </label>

      {error && (
        <div className="aws-form-message aws-form-error">
          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
          {error}
        </div>
      )}

      {successMsg && (
        <div className="aws-form-message aws-form-success">
          <Loader2 size={14} className="animate-spin text-emerald-600" />
          {successMsg}
        </div>
      )}

      <button
        className="cs-action-primary aws-auth-submit"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            Continue to console
            <ArrowRight size={16} />
          </>
        )}
      </button>

      <div className="aws-auth-support">
        <div className="aws-demo-credentials">
          <div>
            <KeyRound size={13} className="text-indigo-600" />
            <p>Local demo credentials</p>
          </div>
          <div>
            <span className="text-slate-500">Email</span>
            <code>demo@cloudshield.local</code>
            <span className="text-slate-500">Password</span>
            <code>CloudShieldDemo123!</code>
          </div>
        </div>

        <div className="aws-auth-notice">
          <Info size={13} className="shrink-0 mt-0.5 text-slate-400" />
          <span>
            <strong className="text-slate-600">Safety:</strong> CloudShield runs in a secure sandbox mode. No AWS scans, API requests, or active remediations are triggered from this login console.
          </span>
        </div>
      </div>
    </form>
  );
}
