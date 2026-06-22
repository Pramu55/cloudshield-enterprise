"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { clearCsrfToken, getCsrfToken } from "../../lib/client-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitationToken");
  const defaultEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !name.trim() || (!organization.trim() && !invitationToken) || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
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
      const csrfToken = await getCsrfToken();
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          organization: organization.trim(),
          password,
          confirmPassword,
          invitationToken: invitationToken || undefined
        })
      });
      clearCsrfToken();

      if (response.status === 409) {
        setError("This email already has access. Please sign in instead.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || "Server unavailable. Please try again.");
        return;
      }

      setSuccessMsg("Workspace created. Redirecting...");
      router.replace("/dashboard");
    } catch {
      setError("Server unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell auth-shell-premium">
      <section className="auth-brand auth-brand-premium">
        <Link href="/" className="auth-logo-link">
          <span className="auth-brand-mark"><ShieldCheck size={18} /></span>
          <strong>CloudShield</strong>
        </Link>

        <div className="auth-hero-copy">
          <span className="auth-eyebrow">Enterprise onboarding</span>
          <h1>{invitationToken ? "Join your CloudShield workspace." : "Create your CloudShield command center."}</h1>
          <p>
            Launch a governed workspace for AWS account readiness, compliance evidence,
            risk ownership, reports, and secure operational review.
          </p>
        </div>

        <div className="auth-signal-card">
          <div>
            <span>Tenant model</span>
            <strong>Workspace scoped</strong>
          </div>
          <div>
            <span>RBAC baseline</span>
            <strong>Owner access</strong>
          </div>
          <div>
            <span>Audit posture</span>
            <strong>Evidence ready</strong>
          </div>
        </div>

        <div className="auth-security-grid">
          <article>
            <span>01</span>
            <strong>Create workspace</strong>
            <p>Start with a secure organization profile and owner account.</p>
          </article>
          <article>
            <span>02</span>
            <strong>Connect cloud accounts</strong>
            <p>Add AWS accounts safely before inventory and posture review.</p>
          </article>
          <article>
            <span>03</span>
            <strong>Govern operations</strong>
            <p>Use approvals, evidence, and controlled workflows for remediation.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel auth-panel-premium">
        <div className="auth-card">
          <h2>{invitationToken ? "Accept invitation" : "Create workspace"}</h2>
          <p>{invitationToken ? "Create your user account to join the team." : "Start with your organization profile."}</p>
          <form className="aws-auth-form" onSubmit={onSubmit}>
            <label>
              <span>Full name</span>
              <input disabled={isSubmitting} onChange={(event) => setName(event.target.value)} placeholder="Jane Doe" type="text" value={name} />
            </label>
            <label>
              <span>Work email</span>
              <input disabled={isSubmitting} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" type="email" value={email} />
            </label>
            {!invitationToken ? (
              <label>
                <span>Organization</span>
                <input disabled={isSubmitting} onChange={(event) => setOrganization(event.target.value)} placeholder="Acme Corp" type="text" value={organization} />
              </label>
            ) : null}
            <label>
              <span>Password</span>
              <div className="auth-password-field">
                <input disabled={isSubmitting} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" type={showPassword ? "text" : "password"} value={password} />
                <button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} type="button">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label>
              <span>Confirm password</span>
              <div className="auth-password-field">
                <input disabled={isSubmitting} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} />
                <button aria-label={showConfirmPassword ? "Hide password" : "Show password"} onClick={() => setShowConfirmPassword((value) => !value)} type="button">
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error ? <div className="aws-form-message aws-form-error">{error}</div> : null}
            {successMsg ? <div className="aws-form-message aws-form-success"><Loader2 size={14} className="animate-spin" />{successMsg}</div> : null}

            <button className="cs-button aws-auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  {invitationToken ? "Join workspace" : "Create workspace"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
          <div className="auth-switch">
            Already have access? <Link href="/login">Sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
