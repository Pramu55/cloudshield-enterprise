import type { RuntimeEnv } from "@cloudshield/config";
import type { AwsConnectorConfig } from "./aws-connector.types.js";

export function getAwsConnectorConfig(env: RuntimeEnv): AwsConnectorConfig {
  return {
    mode: env.AWS_CONNECTOR_MODE,
    region: env.AWS_REGION_DEFAULT,
    roleArn: env.AWS_ROLE_ARN,
    externalId: env.AWS_EXTERNAL_ID,
    executorRoleArn: env.AWS_EXECUTOR_ROLE_ARN,
    allowedAccountIds: env.AWS_ALLOWED_ACCOUNT_IDS
      ? env.AWS_ALLOWED_ACCOUNT_IDS.split(",").map((accountId) => accountId.trim()).filter(Boolean)
      : [],
    allowedRegions: env.AWS_ALLOWED_REGIONS
      ? env.AWS_ALLOWED_REGIONS.split(",").map((region) => region.trim()).filter(Boolean)
      : [env.AWS_REGION_DEFAULT],
    executionMode: env.AWS_CHANGE_EXECUTION_MODE
  };
}
