"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        Work Email
        <input
          className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal focus:ring-1 focus:ring-signal"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          type="email"
          value={email}
          disabled={isSubmitting}
        />
      </label>
      
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        Password
        <input
          className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-signal focus:ring-1 focus:ring-signal"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          type="password"
          value={password}
          disabled={isSubmitting}
        />
      </label>

      {error && (
        <div className="rounded-md border border-alert/30 bg-rose-50 px-3 py-2 text-xs font-medium text-alert">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          {successMsg}
        </div>
      )}

      <button
        className="cs-action-primary flex h-11 w-full items-center justify-center rounded-md text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in..." : "Continue to console"}
      </button>

      {/* Safety Notice & Demo Guideline */}
      <div className="mt-4 space-y-3 rounded-md bg-slate-50 p-4 border border-line">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Local Demo Credentials</p>
          <p className="text-xs text-slate-600 mt-1">
            Use email <span className="font-mono font-semibold bg-white border px-1 rounded text-slate-700">demo@cloudshield.local</span> and password <span className="font-mono font-semibold bg-white border px-1 rounded text-slate-700">CloudShieldDemo123!</span> to access the evaluation environment.
          </p>
        </div>
        <div className="border-t border-line pt-2 text-[11px] leading-relaxed text-slate-500">
          <strong>Safety Note:</strong> CloudShield runs in a secure sandbox mode. No AWS scans, API requests, or active remediations are triggered from this login console.
        </div>
      </div>
    </form>
  );
}
