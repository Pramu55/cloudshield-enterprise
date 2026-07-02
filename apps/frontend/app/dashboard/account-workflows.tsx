"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  CheckCircle2,
  Cloud,
  Edit3,
  KeyRound,
  Loader2,
  Plus,
  Radar,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  X
} from "lucide-react";
import type {
  AwsAccountDto,
  AwsAccountEnvironment,
  AwsAccountListResponse,
  AwsAccountMutationResponse,
  AwsConnectorStatusResponse,
  AwsIdentityValidationResponse,
  AwsInventoryPlanResponse,
  CreateAwsAccountRequest,
  TeamDto,
  UpdateAwsAccountRequest
} from "@cloudshield/contracts";
import { fetchCloudShieldClient, RefreshBadge, useCloudShieldData } from "../../lib/client-api";
import {
  FrontendAwsAccountListSchema,
  FrontendAwsAccountDetailSchema,
  FrontendAwsIdentityValidationSchema,
  FrontendAwsAccountMutationSchema,
  FrontendAwsAccountOnboardingPreflightSchema,
  FrontendCapabilitySessionSchema,
  type FrontendCapabilitySession,
  type FrontendAwsAccountOnboardingPreflight,
  type FrontendAwsIdentityValidation,
  createFrontendInventoryAccountSyncResponseSchema,
  type FrontendInventorySyncResponse
} from "../../lib/response-contracts";
import { inventorySyncFeedback } from "../../lib/inventory-sync-feedback";
import {
  authoritativePermission,
  capabilityPermission,
  permissionCapability,
  resolveAccountMutationCapability,
  runtimeDisabledCapability,
  type ActionCapability
} from "../../lib/action-capability";
import {
  CapabilityNotice,
  GuardedAction,
  PermissionRestriction,
  ProductionRestrictionNotice,
  RuntimeModeRestrictionNotice
} from "../../components/ui/guarded-action";
import {
  DataTable,
  DetailList,
  EmptyState,
  formatDate,
  InlineNotice,
  MetricTile,
  PageHeader,
  Section,
  SourceBadge,
  StatGroup,
  StatusBadge
} from "./shared";

type ActionKey = "save" | "registry" | "identity" | "sync" | "archive";

type ActionState = {
  key: ActionKey;
  accountRecordId?: string;
  label: string;
} | null;

type Feedback = {
  tone: "success" | "warning" | "danger" | "info";
  title: string;
  message: string;
};

type AccountFormState = {
  id?: string;
  name: string;
  accountId: string;
  environment: AwsAccountEnvironment;
  ownerTeamId: string;
  regions: string;
  description: string;
  roleArn: string;
  externalIdConfigured: boolean;
};

type ConfirmState = {
  action: "identity" | "sync" | "archive";
  account: AwsAccountDto;
};

const emptyForm: AccountFormState = {
  name: "",
  accountId: "",
  environment: "DEVELOPMENT",
  ownerTeamId: "",
  regions: "us-east-1",
  description: "",
  roleArn: "",
  externalIdConfigured: false
};

const environmentOptions: AwsAccountEnvironment[] = [
  "DEVELOPMENT",
  "STAGING",
  "PRODUCTION",
  "SECURITY",
  "SHARED",
  "SANDBOX"
];

function actionId(action: ActionKey, accountRecordId?: string) {
  return `${action}:${accountRecordId ?? "new"}`;
}

function actionMatches(active: ActionState, action: ActionKey, accountRecordId?: string) {
  return Boolean(active && actionId(active.key, active.accountRecordId) === actionId(action, accountRecordId));
}

function accountListPath(refreshNonce: number) {
  return `/api/v1/aws/accounts?refresh=${refreshNonce}`;
}

function accountDetailPath(accountId: string, refreshNonce: number) {
  return `/api/v1/aws/accounts/${accountId}?refresh=${refreshNonce}`;
}

export function AccountsWorkspace() {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [form, setForm] = useState<AccountFormState>(emptyForm);
  const [activeAction, setActiveAction] = useState<ActionState>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const accountsState = useCloudShieldData<AwsAccountListResponse>(accountListPath(refreshNonce), { sampleData: false, sampleDataLabel: "", items: [] }, { schema: FrontendAwsAccountListSchema });
  const connectorState = useCloudShieldData<AwsConnectorStatusResponse>("/api/v1/aws/connector/status", defaultConnectorStatus);
  const inventoryPlanState = useCloudShieldData<AwsInventoryPlanResponse>("/api/v1/aws/inventory/plan", defaultInventoryPlan);
  const currentUserState = useCloudShieldData<FrontendCapabilitySession | null>("/api/v1/auth/me", null, { schema: FrontendCapabilitySessionSchema });
  const accounts = accountsState.data.items;
  const manageCapability = permissionCapability(authoritativePermission(currentUserState.data, "accounts.manage"));
  const scanCapability = permissionCapability(authoritativePermission(currentUserState.data, "inventory.scan.request"));
  const canManageAccounts = manageCapability.allowed;
  const canRequestScan = scanCapability.allowed;
  const connectedCount = accounts.filter((account) => account.connectionStatus === "VALIDATION_SUCCEEDED").length;
  const failureCount = accounts.filter((account) => ["AUTH_FAILED", "VALIDATION_FAILED", "PERMISSION_DENIED"].includes(account.connectionStatus)).length;
  const editingAccount = useMemo(() => accounts.find((account) => account.id === form.id), [accounts, form.id]);

  const teamsState = useCloudShieldData<{ teams: TeamDto[] }>("/api/v1/teams", { teams: [] });

  function refresh() {
    setRefreshNonce((value) => value + 1);
  }

  async function saveAccount() {
    if (!canManageAccounts || activeAction) return;
    setFeedback({ tone: "info", title: "Saving account", message: "Saving registry metadata..." });
    setActiveAction({ key: "save", accountRecordId: form.id, label: "Saving registry metadata..." });
    try {
      const payload = toPayload(form);
      const result = await fetchCloudShieldClient<AwsAccountMutationResponse>(
        form.id ? `/api/v1/aws/accounts/${form.id}` : "/api/v1/aws/accounts",
        { method: form.id ? "PATCH" : "POST", body: payload, schema: FrontendAwsAccountMutationSchema }
      );
      setFeedback({ tone: "success", title: "Account saved", message: result.message });
      setForm(emptyForm);
      refresh();
    } catch (error) {
      setFeedback({ tone: "danger", title: "Account save failed", message: errorMessage(error) });
    } finally {
      setActiveAction(null);
    }
  }

  async function validateRegistry(account: AwsAccountDto) {
    if (!canManageAccounts || activeAction) return;
    setFeedback({ tone: "info", title: "Checking registry readiness", message: "Checking registry readiness..." });
    setActiveAction({ key: "registry", accountRecordId: account.id, label: "Checking registry readiness..." });
    try {
      const result = await fetchCloudShieldClient<AwsAccountMutationResponse>(`/api/v1/aws/accounts/${account.id}/validate`, { method: "POST", schema: FrontendAwsAccountMutationSchema });
      setFeedback({ tone: "success", title: "Registry readiness checked", message: result.message });
      refresh();
    } catch (error) {
      setFeedback({ tone: "danger", title: "Registry readiness check failed", message: errorMessage(error) });
    } finally {
      setActiveAction(null);
    }
  }

  async function validateIdentity(account: AwsAccountDto) {
    if (!canManageAccounts || activeAction) return;
    setFeedback({ tone: "info", title: "Validating AWS identity", message: "Validating AWS identity..." });
    setActiveAction({ key: "identity", accountRecordId: account.id, label: "Validating AWS identity..." });
    try {
      const result = await fetchCloudShieldClient<FrontendAwsIdentityValidation>(`/api/v1/aws/accounts/${account.id}/validate-identity`, { method: "POST", schema: FrontendAwsIdentityValidationSchema });
      setFeedback({
        tone: identityTone(result.status),
        title: `STS identity validation: ${result.status}`,
        message: identityMessage(result)
      });
      refresh();
    } catch (error) {
      setFeedback({ tone: "danger", title: "STS identity validation failed", message: errorMessage(error) });
    } finally {
      setActiveAction(null);
    }
  }

  async function startSync(account: AwsAccountDto) {
    if (!canRequestScan || activeAction) return;
    setFeedback({ tone: "info", title: "Starting inventory sync", message: "Starting read-only sync..." });
    setActiveAction({ key: "sync", accountRecordId: account.id, label: "Starting read-only sync..." });
    try {
      const result = await fetchCloudShieldClient<FrontendInventorySyncResponse>(`/api/v1/aws/accounts/${account.id}/inventory/sync`, {
        method: "POST",
        schema: createFrontendInventoryAccountSyncResponseSchema(account.id)
      });
      setFeedback(inventorySyncFeedback(result));
      refresh();
    } catch (error) {
      setFeedback({ tone: "danger", title: "Inventory sync failed", message: errorMessage(error) });
    } finally {
      setActiveAction(null);
    }
  }

  async function archiveAccount(account: AwsAccountDto) {
    if (!canManageAccounts || activeAction) return;
    setFeedback({ tone: "info", title: "Archiving registry record", message: "Archiving registry record..." });
    setActiveAction({ key: "archive", accountRecordId: account.id, label: "Archiving registry record..." });
    try {
      const result = await fetchCloudShieldClient<AwsAccountMutationResponse>(`/api/v1/aws/accounts/${account.id}/archive`, { method: "PATCH", schema: FrontendAwsAccountMutationSchema });
      setFeedback({ tone: "success", title: "Registry record archived", message: result.message });
      refresh();
    } catch (error) {
      setFeedback({ tone: "danger", title: "Archive failed", message: errorMessage(error) });
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={["Cloud", "Accounts"]}
        eyebrow="Multi-account cloud registry"
        title="AWS accounts"
        description="Register, validate, synchronize, and archive CloudShield AWS account records through governed read-only workflows."
        status={<StatusBadge status={connectorState.data.status} />}
        meta={
          <>
            <span>Connector <StatusBadge status={connectorState.data.status} /></span>
            <span>Scanner <StatusBadge status={connectorState.data.scannerStatus} /></span>
            <span>Role {currentUserState.data?.user.role ?? "Member"}</span>
          </>
        }
      />
      <RefreshBadge error={accountsState.error || connectorState.error || inventoryPlanState.error || currentUserState.error || teamsState.error} isRefreshing={accountsState.isRefreshing || connectorState.isRefreshing || inventoryPlanState.isRefreshing || currentUserState.isRefreshing || teamsState.isRefreshing} />
      {feedback ? <InlineNotice title={feedback.title} tone={feedback.tone}>{feedback.message}</InlineNotice> : null}
      <StatGroup>
        <MetricTile label="Registered accounts" value={accounts.length} tone="info" icon={<Cloud size={16} />} />
        <MetricTile label="Identity verified" value={connectedCount} tone={connectedCount ? "success" : "neutral"} icon={<ShieldCheck size={16} />} />
        <MetricTile label="Validation issues" value={failureCount} tone={failureCount ? "danger" : "neutral"} icon={<ShieldAlert size={16} />} />
        <MetricTile label="Resource count" value={connectorState.data.resourceCount} detail="AWS_SYNC records" icon={<Radar size={16} />} />
      </StatGroup>
      <PermissionRestriction capability={manageCapability} />
      {!connectorState.isRefreshing && !connectorState.data.executionEligibility.eligible && connectorState.data.executionEligibility.mode === "disabled" ? <RuntimeModeRestrictionNotice /> : null}
      <div className="cs-account-workspace mt-8 gap-8">
        <AccountFormPanel
          activeAction={activeAction}
          manageCapability={manageCapability}
          editingAccount={editingAccount}
          form={form}
          teams={teamsState.data.teams}
          allowedRegions={connectorState.data.allowedRegions}
          onCancel={() => setForm(emptyForm)}
          onChange={setForm}
          onSave={saveAccount}
        />
        <Section title="Account registry" description="Clean account table with workflow commands kept in a compact action area." icon={<Cloud size={16} />} variant="operational">
          <DataTable
            columns={["Account", "Environment", "Regions", "Connector", "Last scan", "Source", "Actions"]}
            rows={accounts.map((account) => [
              <div key="account">
                <ConsoleAccountLink account={account} />
                <p className="cs-muted-mono">{account.accountId}</p>
                {account.description ? <p className="cs-row-description">{account.description}</p> : null}
              </div>,
              account.environment,
              account.regions.join(", "),
              <StatusBadge key="status" status={account.connectionStatus} />,
              formatDate(account.lastScanAt),
              <SourceBadge key="source" source={account.source} />,
              <AccountCommandBar
                key="actions"
                account={account}
                activeAction={activeAction}
                manageCapability={manageCapability}
                scanCapability={scanCapability}
                connector={connectorState.data}
                inventoryPlan={inventoryPlanState.data}
                onEdit={() => setForm(fromAccount(account))}
                onRegistry={() => validateRegistry(account)}
                onIdentity={() => setConfirm({ action: "identity", account })}
                onSync={() => setConfirm({ action: "sync", account })}
                onArchive={() => setConfirm({ action: "archive", account })}
              />
            ])}
            empty={<button className="cs-button" onClick={() => setForm(emptyForm)} type="button">Register account</button>}
          />
        </Section>
      </div>
      <Section title="Read-only workflow guardrails" description="Command meanings for the account actions restored in this premium workspace." icon={<KeyRound size={16} />} variant="evidence">
        <div className="cs-guardrail-grid">
          <Guardrail title="Registry readiness" body="Checks CloudShield account metadata before explicit STS validation. This check does not call AWS." />
          <Guardrail title="STS identity validation" body="Uses AWS STS GetCallerIdentity only when connector configuration allows it." />
          <Guardrail title="Inventory synchronization" body="Starts the read-only inventory sync endpoint for the selected account and regions." />
          <Guardrail title="Archive registry record" body="Archives CloudShield registry metadata only. It does not modify AWS resources." />
        </div>
      </Section>
      {confirm ? (
        <ConfirmationDialog
          state={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { action, account } = confirm;
            setConfirm(null);
            if (action === "identity") void validateIdentity(account);
            if (action === "sync") void startSync(account);
            if (action === "archive") void archiveAccount(account);
          }}
        />
      ) : null}
    </>
  );
}

export function AccountDetailWorkspace({ accountId }: { accountId: string }) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [activeAction, setActiveAction] = useState<ActionState>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const accountState = useCloudShieldData<{ item: AwsAccountDto } | null>(accountDetailPath(accountId, refreshNonce), null, { schema: FrontendAwsAccountDetailSchema });
  const preflightState = useCloudShieldData<FrontendAwsAccountOnboardingPreflight | null>(
    `/api/v1/aws/accounts/${accountId}/onboarding-preflight?refresh=${refreshNonce}`,
    null,
    { schema: FrontendAwsAccountOnboardingPreflightSchema }
  );
  const connectorState = useCloudShieldData<AwsConnectorStatusResponse>("/api/v1/aws/connector/status", defaultConnectorStatus);
  const inventoryPlanState = useCloudShieldData<AwsInventoryPlanResponse>("/api/v1/aws/inventory/plan", defaultInventoryPlan);
  const currentUserState = useCloudShieldData<FrontendCapabilitySession | null>("/api/v1/auth/me", null, { schema: FrontendCapabilitySessionSchema });
  const account = accountState.data?.item;
  const manageCapability = permissionCapability(authoritativePermission(currentUserState.data, "accounts.manage"));
  const scanCapability = permissionCapability(authoritativePermission(currentUserState.data, "inventory.scan.request"));

  function refresh() {
    setRefreshNonce((value) => value + 1);
  }

  async function runMutation<TResponse>(
    key: ActionKey,
    label: string,
    path: string,
    method: "POST" | "PATCH",
    complete: (result: TResponse) => Feedback,
    schema?: { safeParse(value: unknown): { success: true; data: TResponse } | { success: false } }
  ) {
    if (!account || activeAction) return;
    setFeedback({ tone: "info", title: label, message: label });
    setActiveAction({ key, accountRecordId: account.id, label });
    try {
      const result = await fetchCloudShieldClient<TResponse>(path, { method, schema });
      setFeedback(complete(result));
      refresh();
    } catch (error) {
      setFeedback({ tone: "danger", title: `${label} failed`, message: errorMessage(error) });
    } finally {
      setActiveAction(null);
    }
  }

  if (!account && !accountState.isRefreshing) {
    return (
      <>
        <PageHeader breadcrumbs={["Cloud", "Accounts", accountId]} title="Account unavailable" description="The account record was not returned by the API for this workspace." />
        <RefreshBadge error={accountState.error} isRefreshing={accountState.isRefreshing} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={["Cloud", "Accounts", account?.accountId ?? accountId]}
        eyebrow="AWS account record"
        title={account?.name ?? "Loading account"}
        description="Operational record page for registry metadata, connector state, identity validation, and read-only sync commands."
        status={<StatusBadge status={account?.connectionStatus ?? connectorState.data.status} />}
        meta={
          <>
            <span>Connector <StatusBadge status={connectorState.data.status} /></span>
            <span>Scanner <StatusBadge status={connectorState.data.scannerStatus} /></span>
            <span>Last scan {formatDate(account?.lastScanAt)}</span>
          </>
        }
      />
      <RefreshBadge error={accountState.error || preflightState.error || connectorState.error || inventoryPlanState.error || currentUserState.error} isRefreshing={accountState.isRefreshing || preflightState.isRefreshing || connectorState.isRefreshing || inventoryPlanState.isRefreshing || currentUserState.isRefreshing} />
      {feedback ? <InlineNotice title={feedback.title} tone={feedback.tone}>{feedback.message}</InlineNotice> : null}
      <PermissionRestriction capability={manageCapability} />
      {account?.environment === "PRODUCTION" ? <ProductionRestrictionNotice /> : null}
      {!connectorState.isRefreshing && !connectorState.data.executionEligibility.eligible && connectorState.data.executionEligibility.mode === "disabled" ? <RuntimeModeRestrictionNotice /> : null}
      {account ? (
        <>
          {preflightState.data ? <OnboardingJourney preflight={preflightState.data} /> : null}
          <Section title="Account command center" description="Actions are permission-gated and show per-command progress." icon={<Cloud size={16} />} variant="action">
            <div className="cs-detail-actions">
              <AccountCommandBar
                account={account}
                activeAction={activeAction}
                manageCapability={manageCapability}
                scanCapability={scanCapability}
                connector={connectorState.data}
                inventoryPlan={inventoryPlanState.data}
                onEdit={undefined}
                onRegistry={() => runMutation<AwsAccountMutationResponse>("registry", "Checking registry readiness...", `/api/v1/aws/accounts/${account.id}/validate`, "POST", (result) => ({ tone: "success", title: "Registry readiness checked", message: result.message }), FrontendAwsAccountMutationSchema)}
                onIdentity={() => setConfirm({ action: "identity", account })}
                onSync={() => setConfirm({ action: "sync", account })}
                onArchive={() => setConfirm({ action: "archive", account })}
              />
            </div>
          </Section>
          <div className="cs-two-column mt-8 gap-8">
            <Section title="Account details" icon={<KeyRound size={16} />} variant="detail">
              <DetailList items={[
                { label: "Alias", value: account.name },
                { label: "Cloud account ID", value: <span className="font-mono text-xs">{account.accountId}</span> },
                { label: "Environment", value: account.environment },
                { label: "Owner team", value: account.ownerTeamName ?? "Unassigned" },
                { label: "Regions", value: account.regions.join(", ") },
                { label: "Source", value: <SourceBadge source={account.source} /> },
                { label: "Scanner role", value: account.roleArnDisplay ?? "Not configured" },
                { label: "External ID", value: account.externalIdConfigured ? "Configured in secure runtime" : "Not configured" }
              ]} />
            </Section>
            <Section title="Workflow state" icon={<ShieldCheck size={16} />} variant="status">
              <DetailList items={[
                { label: "Registry status", value: <StatusBadge status={account.status} /> },
                { label: "Connector state", value: <StatusBadge status={account.connectionStatus} /> },
                {
                  label: "Security score",
                  value: (
                    <div className="flex flex-col items-start gap-1">
                      <strong>{scoreLabel(account.securityScore)}</strong>
                      <span className="text-xs text-slate-500">
                        {securityScoreSourceLabel(account.securityScoreSource)}
                      </span>
                    </div>
                  )
                },
                { label: "Cost score", value: scoreLabel(account.costScore) },
                {
                  label: "Compliance posture",
                  value: account.complianceScore === null
                    ? <span className="text-sm text-slate-600">Available in the executive governance projection</span>
                    : `${account.complianceScore}/100`
                },
                { label: "Last scan", value: formatDate(account.lastScanAt) }
              ]} />
            </Section>
          </div>
          <Section title="Inventory and validation context" icon={<Radar size={16} />} variant="evidence">
            <DetailList items={[
              { label: "Identity validation", value: identityStateCopy(account.connectionStatus) },
              { label: "Scanner readiness", value: connectorState.data.scannerStatusLabel },
              { label: "Inventory mode", value: inventoryPlanState.data.scannerMode },
              { label: "Blocked reasons", value: connectorState.data.blockedReasons.length ? connectorState.data.blockedReasons.join("; ") : "No blockers reported" }
            ]} />
            {account.source === "AWS_SYNC" ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="cs-button-secondary"
                  href={`/api/v1/reports/aws/accounts/${account.id}/governance-proof`}
                  target="_blank"
                >
                  View real AWS evidence JSON
                </Link>
                <Link
                  className="cs-link"
                  href={`/api/v1/reports/aws/accounts/${account.id}/governance-proof?download=1`}
                >
                  Download governance proof
                </Link>
              </div>
            ) : null}
          </Section>
        </>
      ) : null}
      {confirm && account ? (
        <ConfirmationDialog
          state={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { action } = confirm;
            setConfirm(null);
            if (action === "identity") {
              void runMutation<FrontendAwsIdentityValidation>("identity", "Validating AWS identity...", `/api/v1/aws/accounts/${account.id}/validate-identity`, "POST", (result) => ({ tone: identityTone(result.status), title: `STS identity validation: ${result.status}`, message: identityMessage(result) }), FrontendAwsIdentityValidationSchema);
            }
            if (action === "sync") {
              void runMutation<FrontendInventorySyncResponse>("sync", "Starting read-only sync...", `/api/v1/aws/accounts/${account.id}/inventory/sync`, "POST", inventorySyncFeedback, createFrontendInventoryAccountSyncResponseSchema(account.id));
            }
            if (action === "archive") {
              void runMutation<AwsAccountMutationResponse>("archive", "Archiving registry record...", `/api/v1/aws/accounts/${account.id}/archive`, "PATCH", (result) => ({ tone: "success", title: "Registry record archived", message: result.message }), FrontendAwsAccountMutationSchema);
            }
          }}
        />
      ) : null}
    </>
  );
}

function AccountCommandBar({
  account,
  activeAction,
  manageCapability,
  scanCapability,
  connector,
  inventoryPlan,
  onEdit,
  onRegistry,
  onIdentity,
  onSync,
  onArchive
}: {
  account: AwsAccountDto;
  activeAction: ActionState;
  manageCapability: ActionCapability;
  scanCapability: ActionCapability;
  connector: AwsConnectorStatusResponse;
  inventoryPlan: AwsInventoryPlanResponse;
  onEdit?: () => void;
  onRegistry: () => void;
  onIdentity: () => void;
  onSync: () => void;
  onArchive: () => void;
}) {
  const identityCapability = !connector.enabled || !connector.configured ? runtimeDisabledCapability() : manageCapability;
  const syncCapability = !inventoryPlan.inventoryScanningEnabled ? runtimeDisabledCapability() : scanCapability;
  const productionMutationCapability = resolveAccountMutationCapability({
    permission: capabilityPermission(manageCapability),
    environment: account.environment,
    runtimeEnabled: connector.executionEligibility.eligible
  });
  return (
    <div className="cs-account-actions gap-3">
      <Link className="cs-button-secondary" href={`/dashboard/accounts/${account.id}`}>Open</Link>
      {onEdit ? <ActionButton capability={manageCapability} icon={<Edit3 size={14} />} label="Edit" disabled={Boolean(activeAction)} onClick={onEdit} /> : null}
      <ActionButton capability={manageCapability} icon={<CheckCircle2 size={14} />} label="Check registry" active={actionMatches(activeAction, "registry", account.id)} activeLabel="Checking registry..." disabled={Boolean(activeAction)} onClick={onRegistry} />
      {!onEdit ? (
        <>
          <ActionButton capability={identityCapability} icon={<ShieldCheck size={14} />} label="Validate identity" active={actionMatches(activeAction, "identity", account.id)} activeLabel="Validating AWS identity..." disabled={Boolean(activeAction)} onClick={onIdentity} />
          <ActionButton capability={syncCapability} icon={<RotateCw size={14} />} label="Read-only sync" active={actionMatches(activeAction, "sync", account.id)} activeLabel="Starting read-only sync..." disabled={Boolean(activeAction)} onClick={onSync} />
          <ActionButton capability={productionMutationCapability.restrictionLayer === "ENVIRONMENT" ? manageCapability : productionMutationCapability} icon={<Archive size={14} />} label="Archive" active={actionMatches(activeAction, "archive", account.id)} activeLabel="Archiving registry record..." disabled={Boolean(activeAction)} danger onClick={onArchive} />
          {account.environment === "PRODUCTION" ? <CapabilityNotice capability={productionMutationCapability} /> : null}
        </>
      ) : null}
    </div>
  );
}

function ActionButton({
  icon,
  capability,
  label,
  active,
  activeLabel,
  disabled,
  danger,
  onClick
}: {
  icon: React.ReactNode;
  capability: ActionCapability;
  label: string;
  active?: boolean;
  activeLabel?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <GuardedAction capability={capability} className={danger ? "cs-action-danger" : "cs-button-secondary"} disabled={disabled} onClick={onClick}>
      {active ? <Loader2 size={14} className="animate-spin" /> : icon}
      {active ? activeLabel : label}
    </GuardedAction>
  );
}

function AccountFormPanel({
  form,
  editingAccount,
  activeAction,
  manageCapability,
  teams,
  allowedRegions,
  onChange,
  onCancel,
  onSave
}: {
  form: AccountFormState;
  editingAccount?: AwsAccountDto;
  activeAction: ActionState;
  manageCapability: ActionCapability;
  teams?: any[];
  allowedRegions?: string[];
  onChange: (form: AccountFormState) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const canManageAccounts = manageCapability.allowed;
  return (
    <Section title={editingAccount ? "Edit account" : "Register account"} description="CloudShield registry metadata only. Do not enter credentials or secrets." icon={<Plus size={16} />} variant="action">
      <div className="cs-account-form gap-6">
        <Field label="Alias" value={form.name} disabled={!canManageAccounts} onChange={(value) => onChange({ ...form, name: value })} />
        <Field label="AWS account ID" value={form.accountId} disabled={!canManageAccounts} onChange={(value) => onChange({ ...form, accountId: value })} />
        <label>
          <span>Environment</span>
          <select disabled={!canManageAccounts} value={form.environment} onChange={(event) => onChange({ ...form, environment: event.target.value as AwsAccountEnvironment })}>
            {environmentOptions.map((environment) => <option key={environment} value={environment}>{environment}</option>)}
          </select>
        </label>
        <Field
          label="Scanner IAM Role ARN"
          value={form.roleArn}
          disabled={!canManageAccounts}
          onChange={(value) => onChange({ ...form, roleArn: value })}
        />
        <label className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <input
              checked={form.externalIdConfigured}
              disabled={!canManageAccounts}
              onChange={(event) => onChange({ ...form, externalIdConfigured: event.target.checked })}
              type="checkbox"
            />
            <strong className="text-[13px] font-bold text-slate-900">External ID configured securely</strong>
          </div>
          <small className="text-[11px] text-slate-500 leading-tight mt-1">Stored in secure runtime environment.</small>
        </label>
        <label>
          <span>Owner team</span>
          <select disabled={!canManageAccounts} value={form.ownerTeamId} onChange={(event) => onChange({ ...form, ownerTeamId: event.target.value })}>
            <option value="">Unassigned</option>
            {teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <label>
          <span>Regions (comma separated)</span>
          <div className="flex flex-wrap gap-2 mb-3">
             {allowedRegions?.map(region => (
                <button
                  key={region}
                  type="button"
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${form.regions.includes(region) ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"} ${!canManageAccounts ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={!canManageAccounts}
                  onClick={() => {
                    const current = form.regions.split(",").map(r => r.trim()).filter(Boolean);
                    if (current.includes(region)) {
                      onChange({ ...form, regions: current.filter(r => r !== region).join(", ") });
                    } else {
                      onChange({ ...form, regions: [...current, region].join(", ") });
                    }
                  }}
                >
                  {region}
                </button>
             ))}
          </div>
          <input disabled={!canManageAccounts} value={form.regions} onChange={(event) => onChange({ ...form, regions: event.target.value })} placeholder="us-east-1, us-west-2" />
        </label>
        <label>
          <span>Description</span>
          <textarea className="min-h-[120px]" disabled={!canManageAccounts} value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} />
        </label>
        <div className="cs-form-actions mt-4 gap-4">
          <GuardedAction capability={manageCapability} className="cs-button" disabled={Boolean(activeAction)} onClick={onSave}>
            {actionMatches(activeAction, "save", form.id) ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {actionMatches(activeAction, "save", form.id) ? "Saving registry metadata..." : editingAccount ? "Save changes" : "Register account"}
          </GuardedAction>
          {form.id ? <button className="cs-button-secondary" onClick={onCancel} type="button">Cancel</button> : null}
        </div>
      </div>
    </Section>
  );
}

function ConfirmationDialog({ state, onCancel, onConfirm }: { state: ConfirmState; onCancel: () => void; onConfirm: () => void }) {
  const copy = confirmationCopy(state);
  return (
    <div className="cs-modal-backdrop" role="presentation">
      <div className="cs-modal" role="dialog" aria-modal="true" aria-labelledby="account-confirm-title">
        <button className="cs-modal-close" onClick={onCancel} type="button" aria-label="Close confirmation"><X size={16} /></button>
        <span className="cs-modal-icon"><ShieldAlert size={18} /></span>
        <h2 id="account-confirm-title">{copy.title}</h2>
        <p>{copy.body}</p>
        <div className="cs-modal-account">
          <strong>{state.account.name}</strong>
          <span>{state.account.accountId}</span>
        </div>
        <div className="cs-modal-actions">
          <button className="cs-button-secondary" onClick={onCancel} type="button">Cancel</button>
          <button className={state.action === "archive" ? "cs-action-danger" : "cs-button"} onClick={onConfirm} type="button">{copy.confirm}</button>
        </div>
      </div>
    </div>
  );
}

function confirmationCopy(state: ConfirmState) {
  if (state.action === "archive") {
    return {
      title: "Archive CloudShield registry record?",
      body: "Archive removes CloudShield registry metadata only. It does not modify AWS resources, credentials, policies, infrastructure, or inventory in AWS.",
      confirm: "Archive registry record"
    };
  }
  if (state.action === "identity") {
    return {
      title: "Validate AWS identity?",
      body: "Identity validation uses AWS STS GetCallerIdentity only. It does not run inventory sync, mutation APIs, Terraform, or remediation.",
      confirm: "Validate STS identity"
    };
  }
  return {
    title: "Start read-only inventory sync?",
    body: "Inventory synchronization is read-only and uses the backend allowlisted inventory workflow for this account and configured regions.",
    confirm: "Start read-only sync"
  };
}

function ConsoleAccountLink({ account }: { account: AwsAccountDto }) {
  return <Link className="cs-link" href={`/dashboard/accounts/${account.id}`}>{account.name}</Link>;
}

function Guardrail({ title, body }: { title: string; body: string }) {
  return (
    <article className="flex flex-col gap-3">
      <strong className="text-slate-900">{title}</strong>
      <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
    </article>
  );
}

function Field({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function toPayload(form: AccountFormState): CreateAwsAccountRequest | UpdateAwsAccountRequest {
  return {
    name: form.name.trim(),
    accountId: form.accountId.trim(),
    environment: form.environment,
    ownerTeamId: form.ownerTeamId.trim() || null,
    regions: form.regions.split(",").map((region) => region.trim()).filter(Boolean),
    description: form.description.trim() || null,
    roleArnPlaceholder: form.roleArn.trim() || null,
    externalIdConfigured: form.externalIdConfigured
  };
}

function fromAccount(account: AwsAccountDto): AccountFormState {
  return {
    id: account.id,
    name: account.name,
    accountId: account.accountId,
    environment: account.environment,
    ownerTeamId: account.ownerTeamId ?? "",
    regions: account.regions.join(", "),
    description: account.description ?? "",
    roleArn: account.roleArnDisplay ?? "",
    externalIdConfigured: account.externalIdConfigured
  };
}

function OnboardingJourney({
  preflight
}: {
  preflight: FrontendAwsAccountOnboardingPreflight;
}) {
  const completed = {
    registered: true,
    iam: preflight.iam.roleAgreement === "MATCH" &&
      preflight.iam.externalIdConfigured &&
      preflight.iam.runtimeExternalIdConfigured,
    validated: preflight.validation.status === "VALIDATED",
    synced: preflight.readiness.phase === "SYNC_COMPLETE",
    review: preflight.readiness.phase === "SYNC_COMPLETE"
  };
  const steps = [
    { label: "Register account", complete: completed.registered },
    { label: "Configure IAM role", complete: completed.iam },
    { label: "Validate identity", complete: completed.validated },
    { label: "Run inventory sync", complete: completed.synced },
    { label: "Review governance posture", complete: completed.review }
  ];

  return (
    <Section
      title="AWS onboarding preflight"
      description="Authoritative, read-only readiness from account metadata and runtime configuration. No AWS call is made by this check."
      icon={<ShieldCheck size={16} />}
      variant="insight"
    >
      <div className="grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => (
          <div className="rounded-xl border border-slate-200 bg-white p-4" key={step.label}>
            <span className="text-xs font-black text-slate-400">0{index + 1}</span>
            <strong className="mt-2 block text-sm text-slate-900">{step.label}</strong>
            <p className={`mt-2 text-xs font-bold ${step.complete ? "text-emerald-700" : "text-amber-700"}`}>
              {step.complete ? "Complete" : "Action required"}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <DetailList items={[
          { label: "Current phase", value: <StatusBadge status={preflight.readiness.phase} /> },
          { label: "Role agreement", value: <StatusBadge status={preflight.iam.roleAgreement} /> },
          { label: "External ID", value: preflight.iam.runtimeExternalIdConfigured ? "Configured securely" : "Not configured" }
        ]} />
        <DetailList items={[
          { label: "Validation", value: <StatusBadge status={preflight.validation.status} /> },
          { label: "Latest scan", value: preflight.scan.latestStatus ? <StatusBadge status={preflight.scan.latestStatus} /> : "No scan" },
          { label: "Resources", value: preflight.scan.resourceCount }
        ]} />
        <div>
          <strong className="text-sm text-slate-900">Next recommended action</strong>
          <p className="mt-2 text-sm text-slate-600">{preflight.readiness.nextAction.label}</p>
          <Link className="cs-button mt-3 inline-flex" href={preflight.readiness.nextAction.href}>Continue workflow</Link>
        </div>
      </div>
      {preflight.readiness.blockedReasons.length ? (
        <InlineNotice title="Readiness blockers" tone="warning">
          {preflight.readiness.blockedReasons.join(" ")}
        </InlineNotice>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="cs-link" href={preflight.links.scans}>Scans</Link>
        <Link className="cs-link" href={preflight.links.inventory}>Inventory</Link>
        <Link className="cs-link" href={preflight.links.findings}>Findings</Link>
        <Link className="cs-link" href={preflight.links.compliance}>Compliance</Link>
        <Link className="cs-link" href={preflight.links.executiveDashboard}>Executive dashboard</Link>
      </div>
    </Section>
  );
}

function identityTone(status: FrontendAwsIdentityValidation["status"]): Feedback["tone"] {
  if (status === "VALIDATION_SUCCEEDED" || status === "CONNECTED") return "success";
  if (status === "BLOCKED_DISABLED" || status === "NOT_CONFIGURED" || status === "READY_FOR_VALIDATION") return "warning";
  if (status === "AUTH_FAILED" || status === "UNREACHABLE" || status === "VALIDATION_FAILED" || status === "PERMISSION_DENIED" || status === "ACCESS_DENIED") return "danger";
  return "info";
}

function identityMessage(result: FrontendAwsIdentityValidation) {
  const parts = [result.message];
  if (result.status === "BLOCKED_DISABLED") parts.push("Connector mode is disabled, so no STS call was executed.");
  if (result.status === "AUTH_FAILED") parts.push("Authentication failed while validating the STS identity.");
  if (result.status === "UNREACHABLE") parts.push("AWS STS was unreachable from the backend environment.");
  if (result.principalArnMasked) parts.push(`Principal: ${result.principalArnMasked}`);
  if (result.validatedAccountId) parts.push(`Validated account: ${result.validatedAccountId}`);
  return parts.join(" ");
}

function identityStateCopy(status: AwsAccountDto["connectionStatus"]) {
  const copy: Record<AwsAccountDto["connectionStatus"], string> = {
    NOT_CONFIGURED: "Not configured",
    READY_FOR_VALIDATION: "Ready for validation",
    VALIDATION_NOT_IMPLEMENTED: "Legacy registry state. Recheck registry readiness before STS validation.",
    VALIDATION_SUCCEEDED: "STS identity validation succeeded.",
    VALIDATION_FAILED: "Validation failed. Review backend message and connector configuration.",
    CONNECTED_DEMO_ONLY: "Sample-only connection state.",
    AUTH_FAILED: "Authentication failed during validation.",
    PERMISSION_DENIED: "Permission denied during validation.",
    DISABLED: "Disabled or archived."
  };
  return copy[status];
}

function scoreLabel(score: number | null) {
  return score === null ? "Awaiting assessment" : `${score}/100`;
}

function securityScoreSourceLabel(
  source: AwsAccountDto["securityScoreSource"]
) {
  if (source === "AWS_SYNC_FINDINGS") {
    return "Computed from active AWS_SYNC findings";
  }
  if (source === "STORED") {
    return "Stored account assessment";
  }
  return "No AWS_SYNC posture evaluation available";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "CloudShield API request failed.";
}

const defaultConnectorStatus: AwsConnectorStatusResponse = {
  mode: "disabled",
  status: "NOT_CONFIGURED",
  enabled: false,
  configured: false,
  region: "us-east-1",
  roleArnConfigured: false,
  externalIdConfigured: false,
  executorRoleConfigured: false,
  allowedRegions: [],
  allowedAwsCall: "none",
  inventoryScan: "not_enabled",
  mutationAccess: "not_enabled",
  scannerStatus: "NOT_CONFIGURED",
  scannerStatusLabel: "Not configured",
  accountEligibility: {
    registeredAccounts: 0,
    eligibleNonProductionAccounts: 0,
    productionAccountsBlocked: 0
  },
  accountIdentityVerified: false,
  lastValidation: null,
  lastSuccessfulScan: null,
  lastFailedScan: null,
  activeScan: null,
  resourceCount: 0,
  blockedReasons: [],
  cloudTrailReadiness: "required",
  executionEligibility: {
    eligible: false,
    mode: "disabled",
    reason: "Governed execution is disabled."
  },
  message: "AWS connector is not configured."
};

const defaultInventoryPlan: AwsInventoryPlanResponse = {
  scannerMode: "disabled",
  inventoryScanningEnabled: false,
  mutationEnabled: false,
  automaticRemediationEnabled: false,
  terraformApplyEnabled: false,
  awsApiCallExecuted: false,
  supportedResourceTypes: [],
  allowedReadOnlyApis: [],
  blockedMutationPatterns: [],
  scanPhases: [],
  sampleDataLabel: "",
  message: "Read-only inventory sync is not configured."
};
