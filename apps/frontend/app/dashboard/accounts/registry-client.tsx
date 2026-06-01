"use client";

import { useMemo, useState } from "react";
import type {
  AwsAccountDto,
  AwsAccountEnvironment,
  AwsAccountMutationResponse,
  AwsConnectionStatus,
  AwsSetupGuideResponse,
  CreateAwsAccountRequest
} from "@cloudshield/contracts";
import { Archive, CheckCircle2, Pencil, Plus, ShieldCheck } from "lucide-react";

type Props = {
  initialAccounts: AwsAccountDto[];
  setupGuide: AwsSetupGuideResponse;
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
  CONNECTED_DEMO_ONLY: "Connected demo only",
  AUTH_FAILED: "Auth failed",
  PERMISSION_DENIED: "Permission denied",
  DISABLED: "Disabled"
};

export function AccountRegistryClient({
  initialAccounts,
  setupGuide
}: Props) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState<FormState>(EmptyForm);
  const [message, setMessage] = useState(
    "AWS account registry only - real AWS scanning is not enabled yet."
  );
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-warning/50 bg-white p-4">
        <p className="text-sm font-semibold text-ink">
          AWS account registry only - real AWS scanning is not enabled yet.
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-md border border-line bg-white">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">
              Registered accounts
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Environment</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Regions</th>
                  <th className="px-4 py-3">Connection</th>
                  <th className="px-4 py-3">Scores</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{account.name}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">
                        {account.accountId}
                      </div>
                      {account.description ? (
                        <div className="mt-1 max-w-xs text-xs text-slate-500">
                          {account.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {account.environment}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {account.ownerTeamName || "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {account.regions.join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {ConnectionLabels[account.connectionStatus]}
                      </span>
                      <div className="mt-1 text-xs text-slate-500">
                        Last scan: {account.lastScanAt || "Not scanned"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>Security: {scoreLabel(account.securityScore)}</div>
                      <div>Cost: {scoreLabel(account.costScore)}</div>
                      <div>Compliance: {scoreLabel(account.complianceScore)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          className="rounded-md border border-line p-2 text-slate-700 hover:bg-slate-50"
                          title="Edit account"
                          type="button"
                          onClick={() => setForm(fromAccount(account))}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-md border border-line p-2 text-slate-700 hover:bg-slate-50"
                          title="Run planned validation check"
                          type="button"
                          onClick={() => validateAccount(account)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-md border border-line p-2 text-slate-700 hover:bg-slate-50"
                          title="Archive registry record"
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

        <div className="rounded-md border border-line bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-signal" />
            <h3 className="text-sm font-semibold text-ink">
              {activeAccount ? "Edit registry record" : "Add registry record"}
            </h3>
          </div>
          <div className="space-y-3">
            <Field
              label="Account name"
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
            />
            <Field
              label="AWS account ID"
              value={form.accountId}
              onChange={(value) => setForm({ ...form, accountId: value })}
            />
            <label className="block text-xs font-semibold text-slate-600">
              Environment
              <select
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink"
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
              label="Regions"
              value={form.regions}
              onChange={(value) => setForm({ ...form, regions: value })}
            />
            <label className="block text-xs font-semibold text-slate-600">
              Notes
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-line px-3 py-2 text-sm text-ink"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
            <div className="flex gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-md bg-signal px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                type="button"
                disabled={isSaving}
                onClick={submitAccount}
              >
                <ShieldCheck className="h-4 w-4" />
                {isSaving ? "Saving" : "Save"}
              </button>
              {activeAccount ? (
                <button
                  className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-slate-700"
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

      <section className="rounded-md border border-line bg-white p-5">
        <h3 className="text-sm font-semibold text-ink">{setupGuide.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {setupGuide.message}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <GuideList title="Planned connection model" items={setupGuide.plannedConnectionModel} />
          <GuideList title="Current limitations" items={setupGuide.currentLimitations} />
        </div>
      </section>
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
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function GuideList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
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
