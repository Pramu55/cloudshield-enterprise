"use client";

import { useState } from "react";
import { DashboardPage, CommandCard, InsightPanel, StatusMatrix } from "../../shared";
import { useCloudShieldData, fetchCloudShieldClient, RefreshBadge } from "../../../../lib/client-api";
import { Users, Mail, ShieldCheck, XCircle, UserPlus, ShieldAlert, Key } from "lucide-react";
import type { MembersListResponse, MemberDto, InvitationDto } from "@cloudshield/contracts";

export default function MembersPage() {
  const { data, error, isRefreshing } = useCloudShieldData<MembersListResponse>("/api/v1/members", { members: [], invitations: [] });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "VIEWER">("VIEWER");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [previewToken, setPreviewToken] = useState("");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteError("");
    setPreviewToken("");
    try {
      const result = await fetchCloudShieldClient<any>("/api/v1/members/invite", {
        method: "POST",
        body: { email, role }
      });
      if (result.previewToken) setPreviewToken(result.previewToken);
      setEmail("");
      window.location.reload(); 
    } catch (err: any) {
      setInviteError(err.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await fetchCloudShieldClient(`/api/v1/members/invite/${id}/revoke`, { method: "POST" });
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to revoke");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await fetchCloudShieldClient(`/api/v1/members/${id}`, { method: "DELETE" });
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to remove");
    }
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      await fetchCloudShieldClient(`/api/v1/members/${id}`, {
        method: "PATCH",
        body: { role: newRole }
      });
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    }
  };

  return (
    <DashboardPage title="Team Members & RBAC" description="Manage organization members, roles, and invitations.">
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <section className="mb-6 grid gap-5 xl:grid-cols-2">
        <InsightPanel title="Invite New Member" description="Send an email invitation to join this organization.">
          <form onSubmit={handleInvite} className="grid gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                required
                className="mt-1 block w-full rounded-md border-line px-3 py-2 text-sm text-ink focus:border-indigo-500 focus:ring-indigo-500"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</label>
              <select
                className="mt-1 block w-full rounded-md border-line px-3 py-2 text-sm text-ink focus:border-indigo-500 focus:ring-indigo-500"
                value={role}
                onChange={e => setRole(e.target.value as "OWNER" | "VIEWER")}
              >
                <option value="VIEWER">Viewer</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
            {inviteError && <p className="text-xs text-danger">{inviteError}</p>}
            <button
              type="submit"
              disabled={inviting}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              <UserPlus size={16} />
              {inviting ? "Sending..." : "Send Invitation"}
            </button>
            {previewToken && (
              <div className="mt-2 text-xs p-2 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                Local Preview Token: {previewToken} <br/>
                <a href={`/invite/${previewToken}`} className="underline" target="_blank" rel="noreferrer">Open Invitation Link</a>
              </div>
            )}
          </form>
        </InsightPanel>
      </section>

      <section className="premium-card mb-6">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-line">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Active Members</h3>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {data.members.map(m => (
            <div key={m.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">{m.name || m.email}</p>
                <p className="text-xs text-slate-500">{m.email}</p>
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={m.role}
                  onChange={(e) => handleUpdateRole(m.userId, e.target.value)}
                  className="rounded-md border-line text-sm text-ink bg-white px-2 py-1"
                  disabled={m.isFinalOwner}
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="OWNER">Owner</option>
                </select>
                <button
                  onClick={() => handleRemove(m.userId)}
                  disabled={m.isFinalOwner}
                  className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="premium-card mb-6">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-line">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
            <Mail size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Pending Invitations</h3>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {data.invitations.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No pending invitations.</div>
          ) : (
            data.invitations.map(i => (
              <div key={i.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{i.email}</p>
                  <p className="text-xs text-slate-500">Role: {i.role} • Status: {i.status}</p>
                </div>
                <div className="flex items-center gap-4">
                  {i.status === "PENDING" && (
                    <button
                      onClick={() => handleRevoke(i.id)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </DashboardPage>
  );
}
