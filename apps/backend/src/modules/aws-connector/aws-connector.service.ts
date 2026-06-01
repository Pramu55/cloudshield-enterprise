import {
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
  AwsReadonlyValidationResult
} from "./aws-connector.types.js";

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
        allowedAwsCall: "none",
        inventoryScan: "not_enabled",
        mutationAccess: "not_enabled",
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
      allowedAwsCall: configured ? "sts:GetCallerIdentity" : "none",
      inventoryScan: "not_enabled",
      mutationAccess: "not_enabled",
      message: configured
        ? "Read-only validation is configured for STS identity validation only. No inventory scan will run."
        : NOT_CONFIGURED_MESSAGE
    });
  }

  async validateReadonlyConnection(): Promise<AwsReadonlyValidationResult> {
    const connector = this.getStatus();

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
      const client = new STSClient({
        region: this.config.region
      });
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
          "STS GetCallerIdentity succeeded. No AWS inventory APIs were called and no AWS resources were changed."
      };
    } catch (error) {
      const status = mapAwsErrorToStatus(error);
      return {
        connector,
        status,
        awsApiCallExecuted: true,
        callerIdentity: null,
        message:
          "STS GetCallerIdentity failed. No AWS inventory APIs were called and no AWS resources were changed."
      };
    }
  }

  private isConfigured() {
    return Boolean(this.config.roleArn && this.config.externalId);
  }
}

function mapAwsErrorToStatus(
  error: unknown
): "AUTH_FAILED" | "PERMISSION_DENIED" | "VALIDATION_FAILED" {
  const awsError = error as Partial<STSServiceException>;
  const name = awsError.name || "";

  if (name.includes("AccessDenied")) {
    return "PERMISSION_DENIED";
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
