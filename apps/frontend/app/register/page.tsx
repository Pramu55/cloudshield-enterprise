"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Info, Loader2, Lock, ShieldAlert, ShieldCheck } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !organization.trim() || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid work email.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.trim(),
          organization: organization.trim(),
          password,
          confirmPassword
        })
      });

      if (response.status === 409) {
        setError("This email already has access. Please sign in instead.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || "Server unavailable. Please try again.");
        return;
      }

      setSuccessMsg("Workspace request created.");

      router.replace("/dashboard");
    } catch {
      setError("Server unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="aws-auth-page">
      <header className="aws-public-topbar">
        <Link className="aws-public-brand" href="/">
          <span><ShieldCheck size={18} /></span>
          <strong>CloudShield</strong>
        </Link>
        <nav aria-label="Auth navigation">
          <Link href="/login">Sign in</Link>
        </nav>
      </header>

      <section className="aws-auth-shell">
        <div className="aws-auth-card aws-auth-card-register">
          <div className="aws-auth-summary">
            <span className="aws-kicker">
              <ShieldAlert size={14} />
              Workspace onboarding
            </span>
            <h1>Create workspace</h1>
            <p>
              Register your CloudShield tenant for cloud governance review,
              evidence tracking, reports, and readiness planning.
            </p>
            <div className="aws-auth-badges">
              <span><CheckCircle2 size={14} /> Tenant-scoped records</span>
              <span><Lock size={14} /> No AWS secrets</span>
              <span><CheckCircle2 size={14} /> Credential-ready later</span>
            </div>
            <div className="aws-auth-alert">
              Registration does not run AWS validation, inventory sync, AWS APIs,
              mutation, Terraform apply, or automatic remediation.
            </div>
          </div>

          <div className="aws-auth-form-panel">
            <h2>Request workspace</h2>
            <p>Deploy CloudShield for your organization.</p>
            <form className="aws-auth-form" onSubmit={onSubmit}>
              <label>
                <span>Work email</span>
                <input
                  disabled={isSubmitting}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  value={email}
                />
              </label>

              <label>
                <span>Organization / workspace name</span>
                <input
                  disabled={isSubmitting}
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder="Acme Corp"
                  type="text"
                  value={organization}
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  disabled={isSubmitting}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  type="password"
                  value={password}
                />
              </label>

              <label>
                <span>Confirm password</span>
                <input
                  disabled={isSubmitting}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter password"
                  type="password"
                  value={confirmPassword}
                />
              </label>

              {error ? (
                <div className="aws-form-message aws-form-error">
                  <span />
                  {error}
                </div>
              ) : null}

              {successMsg ? (
                <div className="aws-form-message aws-form-success">
                  <Loader2 size={14} className="animate-spin" />
                  {successMsg}
                </div>
              ) : null}

              <button className="cs-action-primary aws-auth-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating workspace...
                  </>
                ) : (
                  <>
                    Create workspace
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="aws-auth-notice">
                <Info size={14} />
                <span>
                  <strong>Safety notice:</strong> No AWS credentials or secrets are requested here.
                  CloudShield starts in a local sandbox mode by default.
                </span>
              </div>
            </form>

            <div className="aws-auth-switch">
              Already have access? <Link href="/login">Sign in instead</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
