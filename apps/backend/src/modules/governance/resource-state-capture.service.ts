import { DescribeInstancesCommand, EC2Client } from "@aws-sdk/client-ec2";
import { AssumeRoleCommand, GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import type { RuntimeEnv } from "@cloudshield/config";
import { prisma } from "@cloudshield/database";
import {
  buildCanonicalEc2TagSafetyState,
  computeEc2TagSafetyFingerprint,
  parseCanonicalEc2TagSafetyEvidence,
  resourceStateFingerprintsEqual,
  sanitizeProviderError,
  RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
  RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION
} from "@cloudshield/utils";

export const AUTHORITATIVE_CAPTURE_SOURCE = "PROVIDER_DESCRIBE_INSTANCES" as const;

export type FingerprintCaptureFailure =
  | "FINGERPRINT_CAPTURE_DISABLED"
  | "FINGERPRINT_CAPTURE_NOT_ALLOWED"
  | "FINGERPRINT_CAPTURE_ACCOUNT_MISMATCH"
  | "FINGERPRINT_CAPTURE_ROLE_MISMATCH"
  | "FINGERPRINT_CAPTURE_RESOURCE_NOT_FOUND"
  | "FINGERPRINT_CAPTURE_RESOURCE_MISMATCH"
  | "FINGERPRINT_CAPTURE_PROVIDER_FAILED"
  | "FINGERPRINT_CAPTURE_PERSISTENCE_FAILED"
  | "FINGERPRINT_CAPTURE_CONFLICT"
  | "FINGERPRINT_CAPTURE_APPROVAL_INVALID"
  | "FINGERPRINT_CAPTURE_EXPIRED"
  | "FINGERPRINT_CAPTURE_EVIDENCE_INVALID";

export class FingerprintCaptureError extends Error {
  constructor(
    readonly classification: FingerprintCaptureFailure,
    readonly awsApiCallExecuted: boolean,
    readonly providerRequestId?: string
  ) {
    super(safeCaptureMessage(classification));
    this.name = "FingerprintCaptureError";
  }
}

type CaptureActor = { organizationId: string; userId: string };
type ProviderCapture = {
  accountId: string;
  resourceId: string;
  tags: Record<string, string>;
  providerRequestId?: string;
  maskedPrincipalArn?: string;
};

export type Ec2FingerprintCaptureProvider = (input: {
  expectedAccountId: string;
  region: string;
  resourceId: string;
  roleArn: string;
  externalId: string;
  correlationId: string;
}) => Promise<ProviderCapture>;

type CaptureDependencies = {
  db?: any;
  provider?: Ec2FingerprintCaptureProvider;
  now?: () => Date;
};

export async function captureGovernedEc2ResourceState(
  actor: CaptureActor,
  planId: string,
  correlationId: string,
  env: RuntimeEnv,
  dependencies: CaptureDependencies = {}
) {
  if (env.AWS_CONNECTOR_MODE === "disabled") {
    throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_DISABLED", false);
  }
  const db = dependencies.db ?? prisma;
  const now = dependencies.now?.() ?? new Date();
  const plan = await db.remediationPlan.findFirst({
    where: { id: planId, organizationId: actor.organizationId },
    include: {
      resource: true,
      finding: { include: { awsAccount: true } },
      approvalRequests: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!plan) return null;

  const target = validateCaptureTarget(plan, actor.organizationId, now, env);
  const approval = target.approval;
  await auditCapture(db, actor, plan.id, approval.id, "governance.resource_state.capture_requested", correlationId, {
    accountId: target.account.accountId,
    region: target.region,
    resourceId: target.resource.resourceId,
    source: AUTHORITATIVE_CAPTURE_SOURCE,
    awsApiCallExecuted: false
  });

  let providerCapture: ProviderCapture;
  try {
    providerCapture = await (dependencies.provider ?? createAwsEc2FingerprintCaptureProvider())({
      expectedAccountId: target.account.accountId,
      region: target.region,
      resourceId: target.resource.resourceId,
      roleArn: env.AWS_ROLE_ARN,
      externalId: env.AWS_EXTERNAL_ID,
      correlationId
    });
  } catch (error) {
    const safe = error instanceof FingerprintCaptureError ? error : sanitizeCaptureProviderError(error);
    await auditCaptureFailure(db, actor, plan.id, approval.id, correlationId, target, safe);
    throw safe;
  }

  const providerRequestId = safeRequestId(providerCapture.providerRequestId);
  let evidence: ReturnType<typeof buildCanonicalEc2TagSafetyState>;
  let fingerprint: string;
  let captureMetadata: ResourceStateCaptureMetadata;
  const capturedAt = now;
  try {
    if (providerCapture.accountId !== target.account.accountId) {
      throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_ACCOUNT_MISMATCH", true, providerRequestId);
    }
    if (providerCapture.resourceId !== target.resource.resourceId) {
      throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_RESOURCE_MISMATCH", true, providerRequestId);
    }
    evidence = buildCanonicalEc2TagSafetyState({
      resourceId: target.resource.resourceId,
      accountId: target.account.accountId,
      region: target.region,
      tags: providerCapture.tags
    });
    fingerprint = computeEc2TagSafetyFingerprint({
      resourceId: evidence.resourceId,
      accountId: evidence.accountId,
      region: evidence.region,
      tags: providerCapture.tags
    });
    const maskedPrincipalArn = safeMaskedPrincipalArn(providerCapture.maskedPrincipalArn, target.account.accountId);
    captureMetadata = parseResourceStateCaptureMetadata({
      source: AUTHORITATIVE_CAPTURE_SOURCE,
      capturedAt: capturedAt.toISOString(),
      accountId: evidence.accountId,
      region: evidence.region,
      resourceId: evidence.resourceId,
      schemaVersion: evidence.schemaVersion,
      policyVersion: evidence.policyVersion,
      ...(providerRequestId ? { providerRequestId } : {}),
      ...(maskedPrincipalArn ? { maskedPrincipalArn } : {})
    });
  } catch (error) {
    const safe = error instanceof FingerprintCaptureError
      ? error
      : new FingerprintCaptureError("FINGERPRINT_CAPTURE_EVIDENCE_INVALID", true, providerRequestId);
    await auditCaptureFailure(db, actor, plan.id, approval.id, correlationId, target, safe);
    throw safe;
  }

  try {
    const persisted = await db.$transaction(async (tx: any) => {
      const current = await tx.approvalRequest.findFirst({
        where: { id: approval.id, organizationId: actor.organizationId, remediationPlanId: plan.id }
      });
      if (!current || current.status !== "PENDING") throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_APPROVAL_INVALID", true);
      if (current.expiresAt && current.expiresAt < now) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_EXPIRED", true);
      if (current.resourceStateFingerprint) {
        if (isSameCapture(current, fingerprint, evidence, captureMetadata)) return { approval: current, idempotent: true };
        throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_CONFLICT", true, providerRequestId);
      }
      const snapshot = isPlainObject(current.evidenceSnapshot) ? current.evidenceSnapshot : {};
      const update = await tx.approvalRequest.updateMany({
        where: {
          id: current.id,
          organizationId: actor.organizationId,
          remediationPlanId: plan.id,
          status: "PENDING",
          resourceStateFingerprint: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        data: {
          resourceStateFingerprint: fingerprint,
          resourceStateFingerprintSchemaVersion: RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION,
          resourceStateFingerprintPolicyVersion: RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
          resourceStateCapturedAt: capturedAt,
          resourceStateEvidence: evidence,
          evidenceSnapshot: { ...snapshot, resourceStateCapture: captureMetadata }
        }
      });
      if (update.count !== 1) {
        const latest = await tx.approvalRequest.findFirst({
          where: { id: approval.id, organizationId: actor.organizationId, remediationPlanId: plan.id }
        });
        if (
          latest &&
          latest.status === "PENDING" &&
          (!latest.expiresAt || latest.expiresAt >= now) &&
          latest.resourceStateFingerprint &&
          isSameCapture(latest, fingerprint, evidence, captureMetadata)
        ) {
          return { approval: latest, idempotent: true };
        }
        throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_CONFLICT", true, providerRequestId);
      }
      await auditCapture(tx, actor, plan.id, approval.id, "governance.resource_state.capture_succeeded", correlationId, {
        ...captureMetadata,
        awsApiCallExecuted: true
      });
      const updated = await tx.approvalRequest.findUniqueOrThrow({ where: { id: approval.id } });
      return { approval: updated, idempotent: false };
    });
    return {
      status: "CAPTURED" as const,
      approvalRequestId: approval.id,
      resourceId: evidence.resourceId,
      accountId: evidence.accountId,
      region: evidence.region,
      source: AUTHORITATIVE_CAPTURE_SOURCE,
      capturedAt: persisted.approval.resourceStateCapturedAt.toISOString(),
      schemaVersion: evidence.schemaVersion,
      policyVersion: evidence.policyVersion,
      providerRequestId: captureProviderRequestId(persisted.approval),
      idempotent: persisted.idempotent,
      correlationId
    };
  } catch (error) {
    if (error instanceof FingerprintCaptureError) {
      if (error.classification === "FINGERPRINT_CAPTURE_CONFLICT") {
        try {
          await auditCapture(db, actor, plan.id, approval.id, "governance.resource_state.capture_conflict", correlationId, {
            accountId: target.account.accountId,
            region: target.region,
            resourceId: target.resource.resourceId,
            source: AUTHORITATIVE_CAPTURE_SOURCE,
            failureClassification: error.classification,
            awsApiCallExecuted: true,
            ...(error.providerRequestId ? { providerRequestId: error.providerRequestId } : {})
          });
        } catch {
          // Preserve the fixed conflict response even if conflict auditing is unavailable.
        }
      }
      throw error;
    }
    throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_PERSISTENCE_FAILED", true, providerRequestId);
  }
}

export function validateAuthoritativeApprovalCapture(plan: any, approval: any): string | null {
  try {
    if (!approval?.resourceStateFingerprint || !approval.resourceStateCapturedAt) return "Authoritative resource-state capture is required before approval.";
    if (approval.resourceStateFingerprintSchemaVersion !== RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION) return "Authoritative resource-state capture schema is unsupported.";
    if (approval.resourceStateFingerprintPolicyVersion !== RESOURCE_STATE_FINGERPRINT_POLICY_VERSION) return "Authoritative resource-state capture policy is unsupported.";
    const metadata = captureMetadataFromSnapshot(approval.evidenceSnapshot);
    if (!metadata) return "Authoritative provider capture evidence is required before approval.";
    if (metadata.capturedAt !== approval.resourceStateCapturedAt.toISOString()) return "Authoritative capture timestamp is invalid.";
    const evidence = parseCanonicalEc2TagSafetyEvidence(
      approval.resourceStateEvidence,
      approval.resourceStateFingerprintSchemaVersion,
      approval.resourceStateFingerprintPolicyVersion
    );
    const expectedAccount = plan.finding?.awsAccount?.accountId;
    const expectedRegion = plan.resource?.region;
    const expectedResource = plan.resource?.resourceId;
    if (evidence.accountId !== expectedAccount || metadata.accountId !== expectedAccount) return "Authoritative capture account does not match the plan.";
    if (evidence.region !== expectedRegion || metadata.region !== expectedRegion) return "Authoritative capture region does not match the plan.";
    if (evidence.resourceId !== expectedResource || metadata.resourceId !== expectedResource) return "Authoritative capture resource does not match the plan.";
    const tags = Object.fromEntries(Object.entries(evidence.controlTags).flatMap(([key, tag]) => tag.present ? [[key, tag.value as string]] : []));
    const computed = computeEc2TagSafetyFingerprint({ resourceId: evidence.resourceId, accountId: evidence.accountId, region: evidence.region, tags });
    if (!resourceStateFingerprintsEqual(computed, approval.resourceStateFingerprint)) return "Authoritative capture fingerprint does not match its evidence.";
    return null;
  } catch {
    return "Authoritative resource-state capture evidence is invalid.";
  }
}

export function createAwsEc2FingerprintCaptureProvider(): Ec2FingerprintCaptureProvider {
  return async (input) => {
    if (!parseRoleArn(input.roleArn, input.expectedAccountId) || !input.externalId) {
      throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_NOT_ALLOWED", false);
    }
    let awsApiCallExecuted = false;
    try {
      const bootstrap = new STSClient({ region: input.region });
      awsApiCallExecuted = true;
      const assumed = await bootstrap.send(new AssumeRoleCommand({
        RoleArn: input.roleArn,
        ExternalId: input.externalId,
        RoleSessionName: "cloudshield-fingerprint-capture",
        DurationSeconds: 900
      }));
      const credentials = assumed.Credentials;
      if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
        throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_PROVIDER_FAILED", true, safeRequestId(assumed.$metadata?.requestId));
      }
      const sts = new STSClient({ region: input.region, credentials: { accessKeyId: credentials.AccessKeyId, secretAccessKey: credentials.SecretAccessKey, sessionToken: credentials.SessionToken } });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      const requestId = safeRequestId(identity.$metadata?.requestId);
      if (identity.Account !== input.expectedAccountId) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_ACCOUNT_MISMATCH", true, requestId);
      const principal = parseAssumedRoleArn(identity.Arn, input.expectedAccountId);
      const configuredRole = parseRoleArn(input.roleArn, input.expectedAccountId);
      if (!principal || !configuredRole || principal.rolePath !== configuredRole.rolePath) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_ROLE_MISMATCH", true, requestId);
      const ec2 = new EC2Client({ region: input.region, credentials: { accessKeyId: credentials.AccessKeyId, secretAccessKey: credentials.SecretAccessKey, sessionToken: credentials.SessionToken } });
      const described = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [input.resourceId] }));
      const instances = (described.Reservations ?? []).flatMap((reservation) => reservation.Instances ?? []);
      if (instances.length === 0) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_RESOURCE_NOT_FOUND", true, safeRequestId(described.$metadata?.requestId));
      if (instances.length !== 1 || instances[0]?.InstanceId !== input.resourceId) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_RESOURCE_MISMATCH", true, safeRequestId(described.$metadata?.requestId));
      const tags = Object.fromEntries((instances[0].Tags ?? []).flatMap((tag) => typeof tag.Key === "string" && typeof tag.Value === "string" ? [[tag.Key, tag.Value]] : []));
      return {
        accountId: input.expectedAccountId,
        resourceId: input.resourceId,
        tags,
        providerRequestId: safeRequestId(described.$metadata?.requestId) ?? requestId,
        maskedPrincipalArn: `arn:${principal.partition}:sts::${input.expectedAccountId}:assumed-role/${principal.rolePath}/***`
      };
    } catch (error) {
      if (error instanceof FingerprintCaptureError) throw error;
      throw sanitizeCaptureProviderError(error, awsApiCallExecuted);
    }
  };
}

function validateCaptureTarget(plan: any, organizationId: string, now: Date, env: RuntimeEnv) {
  const account = plan.finding?.awsAccount;
  const resource = plan.resource;
  const payload = plan.normalizedPayload as any;
  if (plan.organizationId !== organizationId || account?.organizationId !== organizationId || resource?.organizationId !== organizationId) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_NOT_ALLOWED", false);
  if (plan.allowlistedOperation !== "EC2_APPLY_GOVERNANCE_TAGS" || plan.lifecycleState !== "PENDING_APPROVAL") throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_NOT_ALLOWED", false);
  if (!account || account.archivedAt || account.connectionStatus === "DISABLED" || account.status === "FAILED") throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_NOT_ALLOWED", false);
  if (account.environment === "prod") throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_NOT_ALLOWED", false);
  if (!account.roleArnPlaceholder || account.roleArnPlaceholder !== env.AWS_ROLE_ARN) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_NOT_ALLOWED", false);
  const allowedAccounts = csv(env.AWS_ALLOWED_ACCOUNT_IDS);
  const allowedRegions = csv(env.AWS_ALLOWED_REGIONS);
  if (!allowedAccounts.includes(account.accountId)) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_NOT_ALLOWED", false);
  if (!resource || resource.awsAccountId !== account.id || resource.archivedAt) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_NOT_ALLOWED", false);
  if (!resource.region || !allowedRegions.includes(resource.region)) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_NOT_ALLOWED", false);
  if (payload?.resourceId !== resource.resourceId || payload?.region !== resource.region) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_RESOURCE_MISMATCH", false);
  if (plan.approvalRequests.length !== 1) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_APPROVAL_INVALID", false);
  const approval = plan.approvalRequests[0];
  if (approval.organizationId !== organizationId || approval.remediationPlanId !== plan.id || approval.status !== "PENDING") throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_APPROVAL_INVALID", false);
  if (approval.expiresAt && approval.expiresAt < now) throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_EXPIRED", false);
  return { account, resource, region: resource.region, approval };
}

function isSameCapture(approval: any, fingerprint: string, evidence: any, metadata: any) {
  if (!resourceStateFingerprintsEqual(approval.resourceStateFingerprint, fingerprint)) return false;
  try {
    const parsed = parseCanonicalEc2TagSafetyEvidence(approval.resourceStateEvidence, RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION, RESOURCE_STATE_FINGERPRINT_POLICY_VERSION);
    const storedMetadata = captureMetadataFromSnapshot(approval.evidenceSnapshot);
    return JSON.stringify(parsed) === JSON.stringify(evidence)
      && storedMetadata?.source === metadata.source
      && storedMetadata?.accountId === metadata.accountId
      && storedMetadata?.region === metadata.region
      && storedMetadata?.resourceId === metadata.resourceId;
  } catch { return false; }
}

export type ResourceStateCaptureMetadata = {
  source: typeof AUTHORITATIVE_CAPTURE_SOURCE;
  capturedAt: string;
  accountId: string;
  region: string;
  resourceId: string;
  schemaVersion: number;
  policyVersion: string;
  providerRequestId?: string;
  maskedPrincipalArn?: string;
};

export function parseResourceStateCaptureMetadata(value: unknown): ResourceStateCaptureMetadata {
  const required = ["source", "capturedAt", "accountId", "region", "resourceId", "schemaVersion", "policyVersion"];
  const allowed = new Set([...required, "providerRequestId", "maskedPrincipalArn"]);
  if (!hasSafeJsonObjectShape(value)) throw new Error("Invalid resource-state capture metadata.");
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) throw new Error("Invalid resource-state capture metadata.");
  for (const key of required) {
    if (!keys.includes(key)) throw new Error("Invalid resource-state capture metadata.");
  }
  const metadata = value as Record<string, unknown>;
  if (metadata.source !== AUTHORITATIVE_CAPTURE_SOURCE) throw new Error("Invalid resource-state capture metadata.");
  if (typeof metadata.capturedAt !== "string" || !isCanonicalTimestamp(metadata.capturedAt)) throw new Error("Invalid resource-state capture metadata.");
  if (typeof metadata.accountId !== "string" || !/^\d{12}$/.test(metadata.accountId)) throw new Error("Invalid resource-state capture metadata.");
  if (typeof metadata.region !== "string" || !/^[a-z]{2}(?:-[a-z0-9]+)+-\d$/.test(metadata.region)) throw new Error("Invalid resource-state capture metadata.");
  if (typeof metadata.resourceId !== "string" || !/^i-[0-9a-f]{8,17}$/.test(metadata.resourceId)) throw new Error("Invalid resource-state capture metadata.");
  if (metadata.schemaVersion !== RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION || metadata.policyVersion !== RESOURCE_STATE_FINGERPRINT_POLICY_VERSION) {
    throw new Error("Invalid resource-state capture metadata.");
  }
  if ("providerRequestId" in metadata && safeRequestId(metadata.providerRequestId) !== metadata.providerRequestId) throw new Error("Invalid resource-state capture metadata.");
  if ("maskedPrincipalArn" in metadata && safeMaskedPrincipalArn(metadata.maskedPrincipalArn, metadata.accountId) !== metadata.maskedPrincipalArn) {
    throw new Error("Invalid resource-state capture metadata.");
  }
  return metadata as ResourceStateCaptureMetadata;
}

function captureMetadataFromSnapshot(snapshot: unknown): ResourceStateCaptureMetadata | null {
  if (!hasSafeJsonObjectShape(snapshot)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(snapshot, "resourceStateCapture");
  if (!descriptor || !("value" in descriptor)) return null;
  try { return parseResourceStateCaptureMetadata(descriptor.value); } catch { return null; }
}

function captureProviderRequestId(approval: any) {
  const value = captureMetadataFromSnapshot(approval.evidenceSnapshot)?.providerRequestId;
  return safeRequestId(value) ?? null;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasSafeJsonObjectShape(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === "string" && Boolean(descriptor?.enumerable && "value" in descriptor);
  });
}

function isCanonicalTimestamp(value: string) {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function parseRoleArn(value: string, accountId: string) {
  const match = /^arn:(aws(?:-us-gov|-cn)?):iam::(\d{12}):role\/(.{1,128})$/.exec(value);
  return match?.[2] === accountId && /^[A-Za-z0-9+=,.@_\/-]+$/.test(match[3] ?? "") ? { partition: match[1], rolePath: match[3] } : null;
}

function parseAssumedRoleArn(value: string | undefined, accountId: string) {
  const match = value ? /^arn:(aws(?:-us-gov|-cn)?):sts::(\d{12}):assumed-role\/(.{1,128})\/([^/]{1,64})$/.exec(value) : null;
  return match?.[2] === accountId && /^[A-Za-z0-9+=,.@_\/-]+$/.test(match[3] ?? "") ? { partition: match[1], rolePath: match[3] } : null;
}

function safeRequestId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value) ? value : undefined;
}

function safeMaskedPrincipalArn(value: unknown, accountId: string) {
  return typeof value === "string"
    && new RegExp(`^arn:aws(?:-us-gov|-cn)?:sts::${accountId}:assumed-role/[A-Za-z0-9+=,.@_/-]{1,128}/\\*\\*\\*$`).test(value)
    ? value
    : undefined;
}

function sanitizeCaptureProviderError(error: unknown, awsApiCallExecuted = true) {
  const safe = sanitizeProviderError(error, { operationName: "EC2_FINGERPRINT_CAPTURE" });
  return new FingerprintCaptureError("FINGERPRINT_CAPTURE_PROVIDER_FAILED", awsApiCallExecuted, safeRequestId(safe.providerRequestId));
}

function csv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function auditCapture(db: any, actor: CaptureActor, planId: string, approvalRequestId: string, action: string, correlationId: string, metadata: Record<string, unknown>) {
  return db.auditEvent.create({
    data: {
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action,
      targetType: "remediation_plan",
      targetId: planId,
      metadata: { correlationId, planId, approvalRequestId, ...metadata, mutationExecuted: false, automaticRemediationExecuted: false, terraformApplyExecuted: false }
    }
  });
}

async function auditCaptureFailure(db: any, actor: CaptureActor, planId: string, approvalRequestId: string, correlationId: string, target: any, error: FingerprintCaptureError) {
  try {
    await db.auditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "governance.resource_state.capture_failed",
        targetType: "remediation_plan",
        targetId: planId,
        metadata: {
          correlationId,
          planId,
          approvalRequestId,
          accountId: target.account.accountId,
          region: target.region,
          resourceId: target.resource.resourceId,
          source: AUTHORITATIVE_CAPTURE_SOURCE,
          failureClassification: error.classification,
          awsApiCallExecuted: error.awsApiCallExecuted,
          ...(error.providerRequestId ? { providerRequestId: error.providerRequestId } : {})
        }
      }
    });
  } catch {
    throw new FingerprintCaptureError("FINGERPRINT_CAPTURE_PERSISTENCE_FAILED", error.awsApiCallExecuted, error.providerRequestId);
  }
}

function safeCaptureMessage(classification: FingerprintCaptureFailure) {
  const messages: Record<FingerprintCaptureFailure, string> = {
    FINGERPRINT_CAPTURE_DISABLED: "Authoritative resource-state capture is disabled.",
    FINGERPRINT_CAPTURE_NOT_ALLOWED: "Authoritative resource-state capture is not allowed for this plan.",
    FINGERPRINT_CAPTURE_ACCOUNT_MISMATCH: "Provider identity did not match the registered AWS account.",
    FINGERPRINT_CAPTURE_ROLE_MISMATCH: "Provider principal did not match the configured scanner role.",
    FINGERPRINT_CAPTURE_RESOURCE_NOT_FOUND: "The approved EC2 resource was not found.",
    FINGERPRINT_CAPTURE_RESOURCE_MISMATCH: "Provider resource identity did not match the approved target.",
    FINGERPRINT_CAPTURE_PROVIDER_FAILED: "The read-only provider inspection failed.",
    FINGERPRINT_CAPTURE_PERSISTENCE_FAILED: "Authoritative capture could not be persisted safely.",
    FINGERPRINT_CAPTURE_CONFLICT: "A different authoritative capture already exists for this approval request.",
    FINGERPRINT_CAPTURE_APPROVAL_INVALID: "The pending approval request is invalid for capture.",
    FINGERPRINT_CAPTURE_EXPIRED: "The pending approval request has expired.",
    FINGERPRINT_CAPTURE_EVIDENCE_INVALID: "Authoritative capture evidence is invalid."
  };
  return messages[classification];
}
