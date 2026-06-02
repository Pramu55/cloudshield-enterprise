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
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        setError("Invalid demo credentials.");
        return;
      }

      const data = (await response.json()) as {
        accessToken: string;
        user: { email: string };
        organization: { name: string };
      };

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
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Unable to reach the CloudShield backend.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input
          className="mt-2 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-signal"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="demo@cloudshield.local"
          type="email"
          value={email}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password
        <input
          className="mt-2 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-signal"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="CloudShieldDemo123!"
          type="password"
          value={password}
        />
      </label>
      {error && (
        <div className="rounded-md border border-alert/40 bg-white px-3 py-2 text-sm text-alert">
          {error}
        </div>
      )}
      <button
        className="cs-action-primary flex h-11 w-full items-center justify-center rounded-md text-sm font-semibold"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in..." : "Continue to console"}
      </button>
      <p className="text-xs leading-5 text-slate-500">
        Local demo credentials only. Sample demo data is used and real AWS
        scanning is not enabled yet.
      </p>
    </form>
  );
}
