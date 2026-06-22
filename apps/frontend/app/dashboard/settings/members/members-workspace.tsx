"use client";

import React, { useState } from "react";
import {
  PageHeader,
  ErrorState,
  StatGroup,
  MetricTile,
  Section,
  DataTable,
  StatusBadge,
  formatDate,
  humanize,
  ActionMenu
} from "../../shared";
import { useCloudShieldData, fetchCloudShieldClient, RefreshBadge } from "../../../../lib/client-api";
import { Circle, UserPlus, Users, Trash2, Mail, MailPlus, RefreshCw, KeyRound, ShieldAlert } from "lucide-react";
import {
  FrontendCapabilitySessionSchema,
  type FrontendCapabilitySession
} from "../../../../lib/response-contracts";
import { authoritativePermission, permissionCapability } from "../../../../lib/action-capability";
import { GuardedAction } from "../../../../components/ui/guarded-action";

type AnyRecord = Record<string, any>;

function pickArray(data: any, keys: string[] = []) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    const value = data?.[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function text(value: any, fallback = "None") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function RoleBadge({ role }: { role: string }) {
  const normalized = String(role).toUpperCase();
  let tone: "neutral" | "info" | "success" | "warning" | "danger" | "disabled" = "neutral";
  
  if (normalized === "OWNER") tone = "danger";
  else if (normalized === "ADMIN") tone = "warning";
  else if (normalized === "SECURITY_OPERATOR" || normalized === "CLOUD_OPERATOR") tone = "info";
  else if (normalized === "VIEWER") tone = "neutral";

  return (
    <span className="cs-status" data-tone={tone}>
      <KeyRound size={13} />
      {normalized}
    </span>
  );
}

export function MembersWorkspace() {
  const members = useCloudShieldData<AnyRecord>("/api/v1/members", { members: [], invitations: [] });
  const teams = useCloudShieldData<AnyRecord>("/api/v1/teams", { teams: [] });
  const auth = useCloudShieldData<FrontendCapabilitySession | null>("/api/v1/auth/me", null, {
    schema: FrontendCapabilitySessionSchema
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const forceRefresh = () => {
    window.location.reload();
  };

  const memberRows = pickArray(members.data, ["members"]);
  const invitationRows = pickArray(members.data, ["invitations"]);
  const teamRows = pickArray(teams.data, ["teams"]);
  
  const inviteCapability = permissionCapability(authoritativePermission(auth.data, "members.invite"));
  const removeCapability = permissionCapability(authoritativePermission(auth.data, "members.remove"));
  const createTeamCapability = permissionCapability(authoritativePermission(auth.data, "teams.create"));
  const archiveTeamCapability = permissionCapability(authoritativePermission(auth.data, "teams.archive"));

  const handleAction = async (action: () => Promise<void>) => {
    setErrorMsg(null);
    setIsRefreshing(true);
    try {
      await action();
      forceRefresh(); // Simple reload to get updated state
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const inviteMember = async () => {
    const email = window.prompt("Enter email address to invite:");
    if (!email) return;
    const role = window.prompt("Enter role (OWNER, ADMIN, SECURITY_OPERATOR, CLOUD_OPERATOR, AUDITOR, VIEWER):", "VIEWER");
    if (!role) return;

    await handleAction(() => fetchCloudShieldClient("/api/v1/members/invite", {
      method: "POST",
      body: { email, role: role.toUpperCase() }
    }));
  };

  const resendInvitation = async (id: string) => {
    if (!window.confirm("Resend invitation?")) return;
    await handleAction(() => fetchCloudShieldClient(`/api/v1/members/invite/${id}/resend`, { method: "POST" }));
  };

  const revokeInvitation = async (id: string) => {
    if (!window.confirm("Revoke invitation?")) return;
    await handleAction(() => fetchCloudShieldClient(`/api/v1/members/invite/${id}/revoke`, { method: "POST" }));
  };

  const removeMember = async (id: string) => {
    if (!window.confirm("Remove member from organization?")) return;
    await handleAction(() => fetchCloudShieldClient(`/api/v1/members/${id}`, { method: "DELETE" }));
  };

  const createTeam = async () => {
    const name = window.prompt("Enter team name:");
    if (!name) return;
    await handleAction(() => fetchCloudShieldClient("/api/v1/teams", {
      method: "POST",
      body: { name }
    }));
  };

  const archiveTeam = async (id: string) => {
    if (!window.confirm("Archive this team?")) return;
    await handleAction(() => fetchCloudShieldClient(`/api/v1/teams/${id}/archive`, { method: "POST" }));
  };

  return (
    <>
      <PageHeader 
        breadcrumbs={["Administration", "Members"]} 
        title="Members and Teams" 
        description="Manage workspace members, roles, teams, and invitations." 
      />
      <RefreshBadge error={members.error || teams.error || errorMsg} isRefreshing={members.isRefreshing || teams.isRefreshing || isRefreshing} />
      
      <StatGroup>
        <MetricTile label="Members" value={memberRows.length} icon={<Users size={16} />} />
        <MetricTile label="Teams" value={teamRows.length} icon={<Users size={16} />} />
        <MetricTile label="Pending Invites" value={invitationRows.filter((r: any) => r.status === "PENDING").length} icon={<Mail size={16} />} />
      </StatGroup>

      <Section 
        title="Member directory" 
        action={(
          <GuardedAction capability={inviteCapability} className="cs-action-primary" onClick={inviteMember}>
            <UserPlus size={14} /> Invite Member
          </GuardedAction>
        )}
      >
        <DataTable
          columns={["Member", "Email", "Role", "Status", "Last active", "Actions"]}
          rows={memberRows.map((member: AnyRecord) => [
            text(member.name ?? member.user?.name, "Member"),
            text(member.email ?? member.user?.email),
            <RoleBadge key="role" role={member.role ?? member.user?.role ?? "VIEWER"} />,
            <StatusBadge key="status" status={member.status ?? member.invitationStatus ?? "ACTIVE"} />,
            formatDate(member.lastActiveAt ?? member.updatedAt),
            <ActionMenu key="actions">
              {member.userId !== auth.data?.user.id && (
                <GuardedAction capability={removeCapability} className="text-red-600 hover:underline text-xs" onClick={() => removeMember(member.userId)}>
                  Remove
                </GuardedAction>
              )}
            </ActionMenu>
          ])}
        />
      </Section>

      <Section title="Invitations">
        <DataTable
          columns={["Email", "Role", "Status", "Sent", "Actions"]}
          rows={invitationRows.map((invite: AnyRecord) => [
            text(invite.email),
            <RoleBadge key="role" role={invite.role} />,
            <StatusBadge key="status" status={invite.status} />,
            formatDate(invite.createdAt),
            <ActionMenu key="actions">
              {invite.status === "PENDING" && (
                <>
                  <GuardedAction capability={inviteCapability} className="text-blue-600 hover:underline text-xs" onClick={() => resendInvitation(invite.id)}>Resend</GuardedAction>
                  <GuardedAction capability={inviteCapability} className="text-red-600 hover:underline text-xs ml-2" onClick={() => revokeInvitation(invite.id)}>Revoke</GuardedAction>
                </>
              )}
            </ActionMenu>
          ])}
        />
      </Section>

      <Section 
        title="Teams" 
        action={(
          <GuardedAction capability={createTeamCapability} className="cs-action-primary" onClick={createTeam}>
            <Users size={14} /> Create Team
          </GuardedAction>
        )}
      >
        <DataTable
          columns={["Team", "Email", "Members", "Created", "Actions"]}
          rows={teamRows.map((team: AnyRecord) => [
            <strong key="name">{text(team.name)}</strong>,
            text(team.email),
            String(team.members?.length || 0),
            formatDate(team.createdAt),
            <ActionMenu key="actions">
              <GuardedAction capability={archiveTeamCapability} className="text-red-600 hover:underline text-xs ml-2" onClick={() => archiveTeam(team.id)}>Archive</GuardedAction>
            </ActionMenu>
          ])}
        />
      </Section>
    </>
  );
}
