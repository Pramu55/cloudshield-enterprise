"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { fetchCloudShieldClient } from "../../../lib/client-api";

type Invitation = {
  email?: string;
  organization?: { name?: string };
  inviter?: { name?: string; email?: string };
};

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = React.use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState<Invitation | null>(null);

  useEffect(() => {
    let active = true;
    fetchCloudShieldClient<Invitation>(`/api/v1/invitations/${token}`)
      .then((payload) => {
        if (active) setInvitation(payload);
      })
      .catch(() => {
        if (active) setError("Invitation unavailable or expired.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError("");
    try {
      await fetchCloudShieldClient("/api/v1/invitations/accept", {
        method: "POST",
        body: { token }
      });
      router.push("/dashboard");
    } catch {
      setError("Unable to accept this invitation. Sign in with the invited email and try again.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <Link href="/">
          <span className="auth-brand-mark"><ShieldCheck size={18} /></span>
          <strong>CloudShield</strong>
        </Link>
        <div>
          <h1>CloudShield workspace invitation.</h1>
          <p>Join the workspace to review posture, evidence, reports, and governed operations with your team.</p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          {loading ? (
            <div className="cs-loading">
              <Loader2 size={16} />
              Loading invitation...
            </div>
          ) : error ? (
            <>
              <div className="aws-form-message aws-form-error">
                <AlertTriangle size={16} />
                {error}
              </div>
              <div className="auth-switch">
                <Link href="/login">Go to sign in</Link>
              </div>
            </>
          ) : (
            <>
              <h2>Join {invitation?.organization?.name ?? "workspace"}</h2>
              <p>
                {invitation?.inviter?.name ?? invitation?.inviter?.email ?? "A workspace administrator"} invited
                {" "}{invitation?.email ?? "your email"} to CloudShield.
              </p>
              <div className="cs-detail-list invite-detail">
                <div>
                  <dt>Invited email</dt>
                  <dd>{invitation?.email ?? "Not reported"}</dd>
                </div>
                <div>
                  <dt>Organization</dt>
                  <dd>{invitation?.organization?.name ?? "Not reported"}</dd>
                </div>
              </div>
              <div className="public-actions">
                <button className="cs-button" disabled={accepting} onClick={handleAccept} type="button">
                  {accepting ? <Loader2 size={15} className="animate-spin" /> : null}
                  Accept invitation
                </button>
                <button className="cs-button-secondary" onClick={() => router.push(`/register?invitationToken=${token}&email=${encodeURIComponent(invitation?.email ?? "")}`)} type="button">
                  Create account
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
