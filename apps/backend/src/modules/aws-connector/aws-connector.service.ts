import {
  AssumeRoleCommand,
  GetCallerIdentityCommand,
  STSClient,
  type STSServiceException
} from "@aws-sdk/client-sts";
import {
  AwsConnectorStatusResponseSchema,
  type AwsConnectorStatusResponse
} from "@cloudshield/contracts";
import type {
  AwsConnectorConfig,
  AwsReadonlyValidationResult,
  AwsIdentityValidationResult
} from "./aws-connector.types.js";
import type { AwsStsValidationResponse } from "@cloudshield/contracts";
import { sanitizeProviderError } from "@cloudshield/utils";

export type AwsStsValidationFailure =
  | "STS_VALIDATION_DISABLED"
  | "ROLE_CONFIGURATION_INVALID"
  | "EXTERNAL_ID_CONFIGURATION_INVALID"
  | "ACCOUNT_NOT_ALLOWLISTED"
  | "ASSUME_ROLE_ACCESS_DENIED"
  | "STS_AUTHENTICATION_FAILED"
  | "STS_RATE_LIMITED"
  | "STS_TRANSIENT_FAILURE"
  | "ACCOUNT_IDENTITY_MISMATCH"
  | "ROLE_PRINCIPAL_MISMATCH"
  | "STS_VALIDATION_FAILED";

export class AwsStsValidationError extends Error {
  constructor(
    readonly classification: AwsStsValidationFailure,
    readonly retryable: boolean,
    readonly awsApiCallExecuted: boolean,
    readonly providerRequestId?: string
  ) {
    super(safeStsFailureMessage(classification));
    this.name = "AwsStsValidationError";
  }
}

const DISABLED_MESSAGE =
  "AWS connector mode is disabled. No AWS API calls were executed.";

const NOT_CONFIGURED_MESSAGE =
  "AWS read-only validation is not configured. AWS_ROLE_ARN and AWS_EXTERNAL_ID placeholders must be configured before validation is enabled.";

export class AwsConnectorService {
  constructor(private readonly config: AwsConnectorConfig) {}

  getStatus(): AwsConnectorStatusResponse {
    if (this.config.mode === "disabled") {
      return AwsConnectorStatusResponseSchema.parse({
        mode: this.config.mode,
        status: "DISABLED",
        enabled: false,
        configured: false,
        region: this.config.region,
        roleArnConfigured: Boolean(this.config.roleArn),
        externalIdConfigured: Boolean(this.config.externalId),
        executorRoleConfigured: Boolean(this.config.executorRoleArn),
        allowedRegions: this.config.allowedRegions,
        allowedAwsCall: "none",
        inventoryScan: "not_enabled",
        mutationAccess: "not_enabled",
        scannerStatus: "BLOCKED",
        scannerStatusLabel: "AWS connector disabled",
        blockedReasons: [DISABLED_MESSAGE],
        executionEligibility: {
          eligible: false,
          mode: this.config.executionMode,
          reason: "Connector mode is disabled."
        },
        message: DISABLED_MESSAGE
      });
    }

    const configured = this.isConfigured();
    return AwsConnectorStatusResponseSchema.parse({
      mode: this.config.mode,
      status: configured ? "READY_FOR_VALIDATION" : "NOT_CONFIGURED",
      enabled: true,
      configured,
      region: this.config.region,
      roleArnConfigured: Boolean(this.config.roleArn),
      externalIdConfigured: Boolean(this.config.externalId),
      executorRoleConfigured: Boolean(this.config.executorRoleArn),
      allowedRegions: this.config.allowedRegions,
      allowedAwsCall: configured ? "sts:GetCallerIdentity" : "none",
      inventoryScan: configured ? "ready" : "not_enabled",
      mutationAccess: this.config.executionMode === "disabled" ? "not_enabled" : "approval_controlled",
      scannerStatus: configured ? "READY_FOR_VALIDATION" : "NOT_CONFIGURED",
      scannerStatusLabel: configured ? "Ready for validation" : "Not configured",
      blockedReasons: configured ? [] : [NOT_CONFIGURED_MESSAGE],
      executionEligibility: {
        eligible: configured && Boolean(this.config.executorRoleArn) && this.config.executionMode !== "disabled",
        mode: this.config.executionMode,
        reason:
          configured && Boolean(this.config.executorRoleArn) && this.config.executionMode !== "disabled"
            ? null
            : "Execution requires connector readiness, executor role configuration, approval, and non-production account opt-in."
      },
      message: configured
        ? "Read-only validation is configured for STS GetCallerIdentity. Inventory sync remains explicit and approval-controlled operations remain worker-driven."
        : NOT_CONFIGURED_MESSAGE
    });
  }

  async validateReadonlyConnection(): Promise<AwsReadonlyValidationResult> {
    const connector = this.getStatus();

    if (this.config.mode === "sts-validation") {
      return {
        connector,
        status: "DISABLED",
        awsApiCallExecuted: false,
        callerIdentity: null,
        message: "Legacy read-only validation is disabled in STS-only validation mode."
      };
    }

    if (connector.status === "DISABLED" || connector.status === "NOT_CONFIGURED") {
      return {
        connector,
        status: connector.status,
        awsApiCallExecuted: false,
        callerIdentity: null,
        message: connector.message
      };
    }

    try {
      const client = await this.createScannerRoleStsClient();
      const identity = await client.send(new GetCallerIdentityCommand({}));

      return {
        connector,
        status: "VALIDATION_SUCCEEDED",
        awsApiCallExecuted: true,
        callerIdentity: {
          account: identity.Account ?? null,
          arn: identity.Arn ?? null,
          userId: identity.UserId ?? null
        },
        message:
          "STS GetCallerIdentity succeeded through the configured scanner role. No AWS inventory APIs were called and no AWS resources were changed."
      };
    } catch (error) {
      const status = mapAwsErrorToStatus(error);
      return {
        connector,
        status,
        awsApiCallExecuted: true,
        callerIdentity: null,
        message:
          "STS GetCallerIdentity failed through the configured scanner role. No AWS inventory APIs were called and no AWS resources were changed."
      };
    }
  }

  async validateIdentity(expectedAccountId: string): Promise<AwsIdentityValidationResult> {
    const connector = this.getStatus();

    if (connector.mode === "disabled") {
      return {
        status: "BLOCKED_DISABLED",
        message: "AWS connector mode is disabled. To enable STS identity validation, set AWS_CONNECTOR_MODE to sts-validation or readonly-validation.",
        accountIdMatched: null,
        registeredAccountId: expectedAccountId,
        validatedAccountId: null,
        principalArnMasked: null,
        awsApiCallExecuted: false,
        allowedAwsCall: "sts:GetCallerIdentity",
        mutationExecuted: false,
        terraformApplyExecuted: false,
        automaticRemediationExecuted: false,
        scannerRun: false,
        credentialStorageMode: "environment-only"
      };
    }

    if (connector.status === "NOT_CONFIGURED" || connector.status === "DISABLED") {
      return {
        status: connector.status as "NOT_CONFIGURED" | "DISABLED",
        message: connector.message,
        accountIdMatched: null,
        registeredAccountId: expectedAccountId,
        validatedAccountId: null,
        principalArnMasked: null,
        awsApiCallExecuted: false,
        allowedAwsCall: "sts:GetCallerIdentity",
        mutationExecuted: false,
        terraformApplyExecuted: false,
        automaticRemediationExecuted: false,
        scannerRun: false,
        credentialStorageMode: "environment-only"
      };
    }

    try {
      const client = await this.createScannerRoleStsClient();
      const identity = await client.send(new GetCallerIdentityCommand({}));

      const returnedAccount = identity.Account ?? null;
      const arn = identity.Arn ?? null;
      const maskedArn = arn ? arn.replace(/(arn:aws:iam::\d{12}:[^\/]+\/).+/, "$1***") : null;
      const accountIdMatched = returnedAccount === expectedAccountId;

      return {
        status: accountIdMatched ? "VALIDATION_SUCCEEDED" : "IDENTITY_MISMATCH",
        message: accountIdMatched 
          ? "STS GetCallerIdentity succeeded and matched the registered AWS account." 
          : `STS GetCallerIdentity succeeded but returned account ${returnedAccount} does not match expected account ${expectedAccountId}.`,
        accountIdMatched,
        registeredAccountId: expectedAccountId,
        validatedAccountId: returnedAccount,
        principalArnMasked: maskedArn,
        awsApiCallExecuted: true,
        allowedAwsCall: "sts:GetCallerIdentity",
        mutationExecuted: false,
        terraformApplyExecuted: false,
        automaticRemediationExecuted: false,
        scannerRun: false,
        credentialStorageMode: "environment-only"
      };
    } catch (error) {
      const status = mapAwsErrorToStatus(error);
      return {
        status,
        message: "STS GetCallerIdentity failed.",
        accountIdMatched: null,
        registeredAccountId: expectedAccountId,
        validatedAccountId: null,
        principalArnMasked: null,
        awsApiCallExecuted: true,
        allowedAwsCall: "sts:GetCallerIdentity",
        mutationExecuted: false,
        terraformApplyExecuted: false,
        automaticRemediationExecuted: false,
        scannerRun: false,
        credentialStorageMode: "environment-only"
      };
    }
  }

  async validateStsOnly(
    expectedAccountId: string,
    correlationId: string
  ): Promise<AwsStsValidationResponse> {
    let awsApiCallExecuted = false;
    try {
      const role = this.validateStsConfiguration(expectedAccountId);
      // Bootstrap identity uses the AWS SDK default credential provider chain.
      // Deployment IAM must restrict it to sts:AssumeRole for the configured role.
      const bootstrap = new STSClient({ region: this.config.region });
      awsApiCallExecuted = true;
      const assumed = await bootstrap.send(
        new AssumeRoleCommand({
          RoleArn: this.config.roleArn,
          ExternalId: this.config.externalId,
          RoleSessionName: "cloudshield-sts-validation",
          DurationSeconds: 900
        })
      );

      const credentials = assumed.Credentials;
      if (
        !credentials?.AccessKeyId ||
        !credentials.SecretAccessKey ||
        !credentials.SessionToken
      ) {
        throw new AwsStsValidationError(
          "STS_AUTHENTICATION_FAILED",
          false,
          true,
          getSafeProviderRequestId(assumed.$metadata)
        );
      }

      const assumedRoleClient = new STSClient({
        region: this.config.region,
        credentials: {
          accessKeyId: credentials.AccessKeyId,
          secretAccessKey: credentials.SecretAccessKey,
          sessionToken: credentials.SessionToken
        }
      });
      const identity = await assumedRoleClient.send(new GetCallerIdentityCommand({}));
      const providerRequestId = getSafeProviderRequestId(identity.$metadata);
      const accountId = identity.Account;
      if (
        !accountId ||
        !/^\d{12}$/.test(accountId) ||
        accountId !== expectedAccountId
      ) {
        throw new AwsStsValidationError(
          "ACCOUNT_IDENTITY_MISMATCH",
          false,
          true,
          providerRequestId
        );
      }
      if (!this.config.allowedAccountIds.includes(accountId)) {
        throw new AwsStsValidationError(
          "ACCOUNT_NOT_ALLOWLISTED",
          false,
          true,
          providerRequestId
        );
      }

      const principal = parseAssumedRoleArn(identity.Arn);
      if (
        !principal ||
        principal.partition !== role.partition ||
        principal.accountId !== accountId ||
        principal.rolePath !== role.rolePath
      ) {
        throw new AwsStsValidationError(
          "ROLE_PRINCIPAL_MISMATCH",
          false,
          true,
          providerRequestId
        );
      }

      return {
        status: "VALIDATED",
        accountId,
        maskedPrincipalArn: `arn:${principal.partition}:sts::${accountId}:assumed-role/${principal.rolePath}/***`,
        roleName: role.roleName,
        validationMode: "STS_ONLY",
        validatedAt: new Date().toISOString(),
        correlationId,
        ...(providerRequestId ? { providerRequestId } : {})
      };
    } catch (error) {
      if (error instanceof AwsStsValidationError) throw error;
      throw sanitizeStsError(error, awsApiCallExecuted);
    }
  }

  private validateStsConfiguration(expectedAccountId: string) {
    if (this.config.mode !== "sts-validation") {
      throw new AwsStsValidationError("STS_VALIDATION_DISABLED", false, false);
    }
    const role = parseRoleArn(this.config.roleArn);
    if (!role || !isValidRegion(this.config.region) || !this.config.allowedRegions.includes(this.config.region)) {
      throw new AwsStsValidationError("ROLE_CONFIGURATION_INVALID", false, false);
    }
    if (this.config.externalId.length < 2 || this.config.externalId.length > 1224) {
      throw new AwsStsValidationError("EXTERNAL_ID_CONFIGURATION_INVALID", false, false);
    }
    if (!/^\d{12}$/.test(expectedAccountId) || role.accountId !== expectedAccountId) {
      throw new AwsStsValidationError("ROLE_CONFIGURATION_INVALID", false, false);
    }
    if (!this.config.allowedAccountIds.includes(expectedAccountId)) {
      throw new AwsStsValidationError("ACCOUNT_NOT_ALLOWLISTED", false, false);
    }
    return role;
  }

  private isConfigured() {
    return Boolean(this.config.roleArn && this.config.externalId);
  }

  private async createScannerRoleStsClient() {
    const bootstrap = new STSClient({ region: this.config.region });
    const assumed = await bootstrap.send(
      new AssumeRoleCommand({
        RoleArn: this.config.roleArn,
        ExternalId: this.config.externalId,
        RoleSessionName: "cloudshield-scanner-validation"
      })
    );

    if (
      !assumed.Credentials?.AccessKeyId ||
      !assumed.Credentials.SecretAccessKey
    ) {
      throw new Error("AssumeRole did not return temporary credentials.");
    }

    return new STSClient({
      region: this.config.region,
      credentials: {
        accessKeyId: assumed.Credentials.AccessKeyId,
        secretAccessKey: assumed.Credentials.SecretAccessKey,
        sessionToken: assumed.Credentials.SessionToken
      }
    });
  }
}

function parseRoleArn(value: string) {
  const match = /^arn:(aws(?:-us-gov|-cn)?):iam::(\d{12}):role\/(.{1,128})$/.exec(value);
  const partition = match?.[1];
  const accountId = match?.[2];
  const rolePath = match?.[3];
  if (!partition || !accountId || !rolePath || !/^[A-Za-z0-9+=,.@_\/-]+$/.test(rolePath)) return null;
  return {
    partition,
    accountId,
    rolePath,
    roleName: rolePath.split("/").at(-1) as string
  };
}

function parseAssumedRoleArn(value: string | undefined) {
  const match = value
    ? /^arn:(aws(?:-us-gov|-cn)?):sts::(\d{12}):assumed-role\/(.{1,128})\/([^/]{1,64})$/.exec(value)
    : null;
  const partition = match?.[1];
  const accountId = match?.[2];
  const rolePath = match?.[3];
  if (!partition || !accountId || !rolePath || !/^[A-Za-z0-9+=,.@_\/-]+$/.test(rolePath)) return null;
  return { partition, accountId, rolePath };
}

function isValidRegion(value: string) {
  return /^[a-z]{2}(?:-[a-z0-9]+)+-\d$/.test(value);
}

function sanitizeStsError(error: unknown, awsApiCallExecuted: boolean) {
  const safe = sanitizeProviderError(error, { operationName: "STS_VALIDATION" });
  const classification = ({
    ACCESS_DENIED: "ASSUME_ROLE_ACCESS_DENIED",
    AUTHENTICATION_FAILED: "STS_AUTHENTICATION_FAILED",
    RATE_LIMITED: "STS_RATE_LIMITED",
    TRANSIENT_NETWORK: "STS_TRANSIENT_FAILURE",
    RESOURCE_NOT_FOUND: "STS_VALIDATION_FAILED",
    INVALID_PROVIDER_CONFIGURATION: "STS_VALIDATION_FAILED",
    UNKNOWN: "STS_VALIDATION_FAILED"
  } as const)[safe.category];
  return new AwsStsValidationError(
    classification,
    safe.retryable,
    awsApiCallExecuted,
    safe.providerRequestId
  );
}

function getSafeProviderRequestId(metadata: {
  requestId?: unknown;
  requestID?: unknown;
  extendedRequestId?: unknown;
} | undefined) {
  const value = metadata?.requestId ?? metadata?.requestID ?? metadata?.extendedRequestId;
  return typeof value === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(value) ? value : undefined;
}

function safeStsFailureMessage(classification: AwsStsValidationFailure) {
  const messages: Record<AwsStsValidationFailure, string> = {
    STS_VALIDATION_DISABLED: "STS-only validation is disabled.",
    ROLE_CONFIGURATION_INVALID: "The STS role configuration is invalid.",
    EXTERNAL_ID_CONFIGURATION_INVALID: "The STS external ID configuration is invalid.",
    ACCOUNT_NOT_ALLOWLISTED: "The AWS account is not allowlisted for STS validation.",
    ASSUME_ROLE_ACCESS_DENIED: "AWS denied the configured role assumption.",
    STS_AUTHENTICATION_FAILED: "AWS STS authentication failed.",
    STS_RATE_LIMITED: "AWS STS rate limited the validation request.",
    STS_TRANSIENT_FAILURE: "AWS STS validation encountered a transient failure.",
    ACCOUNT_IDENTITY_MISMATCH: "The returned AWS account identity did not match.",
    ROLE_PRINCIPAL_MISMATCH: "The returned AWS role principal did not match.",
    STS_VALIDATION_FAILED: "AWS STS validation failed."
  };
  return messages[classification];
}

function mapAwsErrorToStatus(
  error: unknown
): "AUTH_FAILED" | "PERMISSION_DENIED" | "VALIDATION_FAILED" | "UNREACHABLE" {
  const awsError = error as Partial<STSServiceException>;
  const name = awsError.name || "";
  const message = String((awsError as any).message ?? "");

  if (name.includes("AccessDenied")) {
    return "PERMISSION_DENIED";
  }

  if (name.includes("Expired") || message.includes("expired")) {
    return "AUTH_FAILED";
  }

  if (name.includes("Timeout") || name.includes("Networking") || message.includes("ENOTFOUND")) {
    return "UNREACHABLE";
  }

  if (
    name.includes("Credentials") ||
    name.includes("UnrecognizedClient") ||
    name.includes("InvalidClientToken")
  ) {
    return "AUTH_FAILED";
  }

  return "VALIDATION_FAILED";
}
