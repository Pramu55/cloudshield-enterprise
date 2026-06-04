"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AwsAccountDto,
  AwsAccountEnvironment,
  AwsAccountMutationResponse,
  AwsConnectorStatusResponse,
  AwsConnectionStatus,
  AwsInventoryPlanResponse,
  AwsSetupGuideResponse,
  CreateAwsAccountRequest,
  AwsIdentityValidationResponse
} from "@cloudshield/contracts";
import { Archive, CheckCircle2, Pencil, Plus, ShieldCheck, HelpCircle, ShieldAlert, KeyRound, Cloud } from "lucide-react";

type Props = {
  initialAccounts: AwsAccountDto[];
  setupGuide: AwsSetupGuideResponse;
  connectorStatus: AwsConnectorStatusResponse;
  inventoryPlan: AwsInventoryPlanResponse;
};

type FormState = {
  id?: string;
  name: string;
  accountId: string;
  environment: AwsAccountEnvironment;
  ownerTeamId: string;
  regions: string;
  description: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

const EmptyForm: FormState = {
  name: "",
  accountId: "",
  environment: "DEVELOPMENT",
  ownerTeamId: "",
  regions: "us-east-1",
  description: ""
};

const EnvironmentOptions: AwsAccountEnvironment[] = [
  "DEVELOPMENT",
  "STAGING",
  "PRODUCTION",
  "SECURITY",
  "SHARED",
  "SANDBOX"
];

const ConnectionLabels: Record<AwsConnectionStatus, string> = {
  NOT_CONFIGURED: "Not configured",
  READY_FOR_VALIDATION: "Ready for validation",
  VALIDATION_NOT_IMPLEMENTED: "Validation not implemented",
  VALIDATION_SUCCEEDED: "Validation succeeded",
  VALIDATION_FAILED: "Validation failed",
  CONNECTED_DEMO_ONLY: "Connected demo only",
  AUTH_FAILED: "Auth failed",
  PERMISSION_DENIED: "Permission denied",
  DISABLED: "Disabled"
};

export function AccountRegistryClient({
  initialAccounts,
  setupGuide,
  connectorStatus,
  inventoryPlan
}: Props) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [connector, setConnector] = useState(connectorStatus);
  const [form, setForm] = useState<FormState>(EmptyForm);
  const [message, setMessage] = useState(
    "AWS account registry only - real AWS inventory scanning is not enabled yet."
  );
  const [isSaving, setIsSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState<{
    type: "validate" | "scan";
    account: AwsAccountDto;
  } | null>(null);

  const [lastValidationResult, setLastValidationResult] = useState<{
    accountId: string;
    callerArn: string;
    validationTime: string;
    region: string;
    mode: string;
    awsApiCallExecuted: boolean;
  } | null>(null);

  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

  useEffect(() => {
    setConnector(connectorStatus);
  }, [connectorStatus]);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === form.id),
    [accounts, form.id]
  );

  async function submitAccount() {
    setIsSaving(true);
    setMessage("Saving registry metadata. No AWS API calls will be made.");

    try {
      const payload = toPayload(form);
      const path = form.id
        ? `/api/v1/aws/accounts/${form.id}`
        : "/api/v1/aws/accounts";
      const method = form.id ? "PATCH" : "POST";
      const result = await apiRequest<AwsAccountMutationResponse>(path, {
        method,
        body: JSON.stringify(payload)
      });

      setAccounts((current) => upsertAccount(current, result.item));
      setForm(EmptyForm);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save account.");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveAccount(account: AwsAccountDto) {
    setMessage("Archiving registry metadata only. No AWS resources will change.");

    try {
      const result = await apiRequest<AwsAccountMutationResponse>(
        `/api/v1/aws/accounts/${account.id}/archive`,
        { method: "PATCH" }
      );
      setAccounts((current) =>
        current.filter((item) => item.id !== result.item.id)
      );
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive account.");
    }
  }

  async function validateAccount(account: AwsAccountDto) {
    setMessage(setupGuide.validation.message);

    try {
      const result = await apiRequest<
        AwsAccountMutationResponse & { code: string }
      >(`/api/v1/aws/accounts/${account.id}/validate`, { method: "POST" });
      setAccounts((current) => upsertAccount(current, result.item));
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to run validation check.");
    }
  }

  async function validateIdentity(account: AwsAccountDto) {
    if (connector.status === "DISABLED" || connector.status === "NOT_CONFIGURED") {
      setMessage(connector.message);
      return;
    }

    setMessage("Running STS identity validation only. No inventory scan will run.");

    try {
      const result = await apiRequest<AwsIdentityValidationResponse>(
        `/api/v1/aws/accounts/${account.id}/validate-identity`,
        { method: "POST" }
      );
      
      // Update account status in our list
      setAccounts((current) => current.map((item) => 
        item.id === account.id 
          ? { ...item, connectionStatus: result.status as AwsConnectionStatus }
          : item
      ));

      setMessage(result.message);

      if (result.principalArnMasked) {
        setLastValidationResult({
          accountId: result.validatedAccountId || "N/A",
          callerArn: result.principalArnMasked || "N/A",
          validationTime: new Date().toLocaleString(),
          region: connector.region || "us-east-1",
          mode: connector.mode,
          awsApiCallExecuted: result.awsApiCallExecuted
        });
      } else {
        setLastValidationResult({
          accountId: "N/A",
          callerArn: "N/A",
          validationTime: new Date().toLocaleString(),
          region: connector.region || "us-east-1",
          mode: connector.mode,
          awsApiCallExecuted: result.awsApiCallExecuted
        });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to validate read-only connection.");
      setLastValidationResult(null);
    }
  }

  async function startScan(account: AwsAccountDto) {
    if (inventoryPlan.scannerMode === "disabled" || inventoryPlan.scannerMode === "readonly-plan") {
      setMessage("Read-only inventory sync is disabled. Set AWS_INVENTORY_SCANNER_MODE=readonly to enable the explicit sync button.");
      return;
    } else {
      setMessage("Starting read-only inventory sync. STS identity will be verified first.");
    }

    try {
      const result = await apiRequest<any>(
        `/api/v1/aws/accounts/${account.id}/inventory/sync`,
        { method: "POST" }
      );
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start scan.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="safety-banner border border-amber-200/50 bg-amber-50/70 p-4 rounded-xl flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
        <div className="text-xs">
          <p className="font-bold text-amber-900 uppercase tracking-wider">Operational Console Message</p>
          <p className="mt-1 leading-relaxed text-amber-800">{message}</p>
        </div>
      </section>

      <section className="premium-card p-5">
        <div className="grid gap-4 md:grid-cols-4 border-b border-line pb-4 mb-4">
          <StatusTile label="Connector mode" value={connector.mode} />
          <StatusTile label="Read-only validation" value={connector.status} />
              <StatusTile label="Inventory sync" value={inventoryPlan.inventoryScanningEnabled ? "Read-only enabled" : "Disabled"} />
          <StatusTile
            label="AWS credentials"
            value="No credentials in DB"
          />
        </div>
        <div className="flex gap-2 items-center text-xs text-slate-500 bg-slate-50 border border-line p-3 rounded-lg">
          <HelpCircle size={14} className="text-slate-400 shrink-0" />
          <span>
            STS identity is verified before inventory sync. Inventory remains disabled unless read-only mode is explicitly configured, and no AWS resources are changed.
          </span>
        </div>
        <p className="mt-2 text-xs font-semibold text-indigo-600">
          {connector.message}
        </p>
      </section>

      {lastValidationResult && (
        <section className="premium-card border-emerald-300 bg-emerald-50/50 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
            <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-2 uppercase tracking-wider">
              <span className="status-dot-pulse bg-emerald-500" />
              Live AWS STS Connection Validated Successfully
            </h4>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
              awsApiCallExecuted={String(lastValidationResult.awsApiCallExecuted)}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 text-xs text-slate-700">
            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">AWS Account ID</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{lastValidationResult.accountId}</p>
            </div>
            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Caller ARN</p>
              <p className="mt-1 font-mono text-xs font-semibold text-slate-800 break-all">{lastValidationResult.callerArn}</p>
            </div>
            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Validation Region</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{lastValidationResult.region}</p>
            </div>
            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Connector Mode</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 uppercase">{lastValidationResult.mode}</p>
            </div>
            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Timestamp</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{lastValidationResult.validationTime}</p>
            </div>
          </div>
        </section>
      )}

      <section className="premium-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-line pb-4 mb-4">
          <div className="flex gap-3 items-start">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Cloud size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                AWS read-only inventory scanner plan
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {inventoryPlan.message} {inventoryPlan.sampleDataLabel}
              </p>
            </div>
          </div>
          <span className="status-pill border-amber-200 bg-amber-50 text-amber-700 py-0.5 text-[10px] font-bold self-start">
            awsApiCallExecuted=false
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <GuideList
              title="Planned resource types"
              items={inventoryPlan.supportedResourceTypes.map((item) =>
                  item.replaceAll("_", " ")
              )}
          />
          <GuideList
              title="Read-only API allowlist"
              items={inventoryPlan.allowedReadOnlyApis
                  .slice(0, 6)
                  .map(
                      (operation) =>
                          `${operation.service}:${operation.operation} - ${operation.notes}`
                  )}
          />
          <GuideList
              title="Blocked mutation patterns"
              items={inventoryPlan.blockedMutationPatterns}
          />
        </div>
        <div className="mt-5 pt-4 border-t border-line text-xs font-semibold text-slate-500">
          Automatic remediation, AWS mutation, and Terraform apply remain disabled.
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="premium-card">
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-sm font-bold text-ink">
              Registered Accounts Registry
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Account details</th>
                  <th className="px-5 py-3">Topology</th>
                  <th className="px-5 py-3">Env</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Regions</th>
                  <th className="px-5 py-3">Connection</th>
                  <th className="px-5 py-3">Posture</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-ink">{account.name}</div>
                      <div className="mt-1 font-mono text-[11px] text-slate-400">
                        {account.accountId}
                      </div>
                      {account.description ? (
                        <div className="mt-1 max-w-xs text-xs text-slate-500 line-clamp-2">
                          {account.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs font-bold text-ink">{account.environment === "PRODUCTION" ? "Retail Cloud" : "Enterprise Core"}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{account.environment === "SECURITY" ? "Security Operations" : "Platform Engineering"}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-700 font-semibold text-xs">
                      {account.environment}
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs font-medium">
                      {account.ownerTeamName || "Unassigned"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs font-medium">
                      {account.regions.join(", ")}
                    </td>
                    <td className="px-5 py-4">
                      <span className="status-pill border-slate-200 bg-slate-100 text-slate-700 py-0.5 text-[10px]">
                        {ConnectionLabels[account.connectionStatus]}
                      </span>
                      <div className="mt-1 text-[10px] text-slate-400 font-medium">
                        Last scan: {account.lastScanAt ? new Date(account.lastScanAt).toLocaleString() : "Never"}
                      </div>
                      {account.connectionStatus === "VALIDATION_SUCCEEDED" && (
                        <div className="text-[10px] text-slate-400 font-medium">
                          Validated: {new Date(account.updatedAt).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 font-medium space-y-0.5">
                      <div>Security: {scoreLabel(account.securityScore)}</div>
                      <div>Cost: {scoreLabel(account.costScore)}</div>
                      <div>Compliance: {scoreLabel(account.complianceScore)}</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-2.5 justify-end">
                        <button
                          className="rounded-lg border border-line p-1.5 text-slate-600 hover:bg-slate-100 hover:text-ink transition-colors min-h-0"
                          title="Edit Account Details"
                          type="button"
                          onClick={() => setForm(fromAccount(account))}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-lg border border-line p-1.5 text-slate-600 hover:bg-slate-100 hover:text-ink transition-colors min-h-0"
                          title="Run Database-only Connection Posture Check"
                          type="button"
                          onClick={() => validateAccount(account)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-lg border border-line p-1.5 text-slate-600 hover:bg-slate-100 hover:text-ink transition-colors min-h-0 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            connector.enabled
                              ? "Validate AWS Identity"
                              : connector.message
                          }
                          type="button"
                          disabled={!connector.enabled || !connector.configured}
                          onClick={() => setModalOpen({ type: "validate", account })}
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-lg border border-line px-2.5 py-1 text-slate-600 hover:bg-slate-100 hover:text-ink transition-colors min-h-0 disabled:cursor-not-allowed disabled:opacity-40 text-xs font-bold"
                          title={
                            inventoryPlan.inventoryScanningEnabled
                              ? "Start read-only inventory sync"
                              : "Read-only inventory sync is disabled."
                          }
                          type="button"
                          disabled={!inventoryPlan.inventoryScanningEnabled}
                          onClick={() => setModalOpen({ type: "scan", account })}
                        >
                          Start Read-only Inventory Sync
                        </button>
                        <button
                          className="rounded-lg border border-line p-1.5 text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors min-h-0"
                          title="Archive Registry Record"
                          type="button"
                          onClick={() => archiveAccount(account)}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="premium-card p-5 h-fit">
          <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
            <Plus className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-ink">
              {activeAccount ? "Edit Account Details" : "Add Account Details"}
            </h3>
          </div>
          <div className="space-y-4">
            <Field
              label="Account name"
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
            />
            <Field
              label="AWS account ID (12 digits)"
              value={form.accountId}
              onChange={(value) => setForm({ ...form, accountId: value })}
            />
            <label className="block text-xs font-bold text-slate-600">
              Environment Class
              <select
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink bg-white outline-none"
                value={form.environment}
                onChange={(event) =>
                  setForm({
                    ...form,
                    environment: event.target.value as AwsAccountEnvironment
                  })
                }
              >
                {EnvironmentOptions.map((environment) => (
                  <option key={environment} value={environment}>
                    {environment}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Owner team ID"
              value={form.ownerTeamId}
              onChange={(value) => setForm({ ...form, ownerTeamId: value })}
            />
            <Field
              label="Regions (comma separated)"
              value={form.regions}
              onChange={(value) => setForm({ ...form, regions: value })}
            />
            <label className="block text-xs font-bold text-slate-600">
              Description notes
              <textarea
                className="mt-1 min-h-20 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
            <div className="flex gap-2 pt-2 border-t border-line">
              <button
                className="cs-action-signal inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold shadow-sm"
                type="button"
                disabled={isSaving}
                onClick={submitAccount}
              >
                <ShieldCheck className="h-4 w-4" />
                {isSaving ? "Saving" : "Save Record"}
              </button>
              {activeAccount ? (
                <button
                  className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  type="button"
                  onClick={() => setForm(EmptyForm)}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="premium-card p-5">
        <h3 className="text-sm font-bold text-ink border-b border-line pb-3 mb-4">{setupGuide.title}</h3>
        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          {setupGuide.message}
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <GuideList title="Planned connection model" items={setupGuide.plannedConnectionModel} />
          <GuideList title="Current limitations" items={setupGuide.currentLimitations} />
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-base font-bold text-ink border-b border-line pb-3 flex items-center gap-2">
              <ShieldAlert className="text-amber-500" size={18} />
              {modalOpen.type === "validate" ? "Confirm STS Identity validation" : "Confirm Read-only Inventory Sync"}
            </h4>
            
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {modalOpen.type === "validate" ? (
                <>
                  You are initiating a live connection validation. This requests a caller identity check via <strong>AWS STS GetCallerIdentity API</strong>. No mutation will run and no active scanner operations will execute.
                </>
              ) : (
                <>
                  You are initiating a read-only inventory synchronization. CloudShield validates STS identity first, then requests only the allowlisted Phase 1 APIs. No Terraform apply or mutations will execute.
                </>
              )}
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 border border-line p-3 text-xs text-slate-500 font-medium">
              <p>Account: <span className="font-bold text-ink">{modalOpen.account.name}</span></p>
              <p>AWS ID: <span className="font-bold text-ink font-mono">{modalOpen.account.accountId}</span></p>
              <p className="mt-2 flex items-center gap-1.5 text-indigo-600 font-bold text-[10px] uppercase tracking-wider">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
                Safe read-only execution guard active
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                className="rounded-lg border border-line bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all min-h-0"
                onClick={() => setModalOpen(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-all min-h-0 active:scale-95 shadow-sm"
                onClick={() => {
                  const acc = modalOpen.account;
                  const type = modalOpen.type;
                  setModalOpen(null);
                  if (type === "validate") {
                    void validateIdentity(acc);
                  } else {
                    void startScan(acc);
                  }
                }}
                type="button"
              >
                {modalOpen.type === "validate" ? "Confirm Validate" : "Confirm Sync"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50/50 border border-line p-3 rounded-lg">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-ink leading-tight capitalize">{value}</p>
    </div>
  );
}

function GuideList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-slate-50/30 border border-line p-4 rounded-xl">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-line pb-2 mb-2">{title}</p>
      <ul className="space-y-1.5 text-xs leading-relaxed text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-indigo-400 font-bold">&bull;</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function toPayload(form: FormState): CreateAwsAccountRequest {
  return {
    name: form.name,
    accountId: form.accountId,
    environment: form.environment,
    ownerTeamId: form.ownerTeamId || null,
    regions: form.regions
      .split(",")
      .map((region) => region.trim())
      .filter(Boolean),
    description: form.description || null
  };
}

function fromAccount(account: AwsAccountDto): FormState {
  return {
    id: account.id,
    name: account.name,
    accountId: account.accountId,
    environment: account.environment,
    ownerTeamId: account.ownerTeamId || "",
    regions: account.regions.join(", "),
    description: account.description || ""
  };
}

function upsertAccount(accounts: AwsAccountDto[], account: AwsAccountDto) {
  const existing = accounts.some((item) => item.id === account.id);
  if (!existing) {
    return [...accounts, account].sort((a, b) => a.name.localeCompare(b.name));
  }

  return accounts.map((item) => (item.id === account.id ? account : item));
}

function scoreLabel(score: number | null) {
  return score === null ? "Pending" : `${score}/100`;
}

async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const token = window.localStorage.getItem("cloudshield_access_token");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token || ""}`
  };

  if (init.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {})
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "CloudShield API request failed.");
  }

  return payload as T;
}
