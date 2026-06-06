"use client";

import { useEffect, useState } from "react";
import { fetchCloudShieldClient } from "../../../lib/client-api";
import { Shield, CheckCircle, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import React from "react";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = React.use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/v1/invitations/${token}`)
      .then(res => res.json().then(data => ({ status: res.status, data })))
      .then(({ status, data }) => {
        if (status === 200) {
          setInvitation(data);
        } else {
          setError(data.message || "Invalid invitation");
        }
      })
      .catch(err => setError("Network error"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    try {
      await fetchCloudShieldClient("/api/v1/invitations/accept", {
        method: "POST",
        body: { token }
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation. Make sure you are logged in with the matching email.");
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500 font-medium">Loading invitation...</div>;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="premium-card p-8 max-w-md w-full text-center">
          <AlertTriangle size={48} className="mx-auto text-danger mb-4" />
          <h2 className="text-xl font-bold text-ink mb-2">Invitation Error</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link href="/login" className="text-indigo-600 font-semibold hover:underline">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="premium-card p-8 max-w-md w-full text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-6 shadow-inner border border-indigo-100">
          <Shield size={32} />
        </div>
        <h2 className="text-2xl font-bold text-ink mb-2">Join {invitation?.organization?.name}</h2>
        <p className="text-slate-500 mb-6 text-sm leading-relaxed">
          <strong>{invitation?.inviter?.name || invitation?.inviter?.email}</strong> has invited you to collaborate on CloudShield Enterprise.
        </p>

        <div className="bg-slate-50 border border-line rounded-lg p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Invited Email</p>
          <p className="text-sm font-bold text-ink">{invitation?.email}</p>
        </div>

        <p className="text-sm text-slate-500 mb-6">
          If you already have an account with this email, please log in first, then accept this invitation.
          If you do not have an account, please register using this token.
        </p>

        <div className="grid gap-3">
          <button
            onClick={handleAccept}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-indigo-500 transition-colors"
          >
            Accept Invitation
          </button>
          <div className="text-xs font-semibold text-slate-400 my-1 uppercase tracking-widest">or</div>
          <button
            onClick={() => router.push(`/register?invitationToken=${token}&email=${encodeURIComponent(invitation?.email)}`)}
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            Create New Account
          </button>
        </div>
      </div>
    </div>
  );
}
