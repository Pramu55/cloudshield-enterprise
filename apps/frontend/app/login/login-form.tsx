"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, KeyRound, Info } from "lucide-react";
import { getCsrfToken, clearCsrfToken } from "../../lib/client-api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const csrfToken = await getCsrfToken();
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        body: JSON.stringify({ email: email.trim(), password })
      });
      clearCsrfToken();

      if (response.status === 401) {
        setError("Invalid email or password.");
        return;
      }

      if (!response.ok) {
        setError("Server unavailable. Please try again.");
        return;
      }

      await response.json();

      setSuccessMsg("Login successful. Redirecting...");
      
      const nextPath = new URLSearchParams(window.location.search).get("next");
      const destination = nextPath?.startsWith("/dashboard")
        ? nextPath
        : "/dashboard";
      
      router.replace(destination);
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
