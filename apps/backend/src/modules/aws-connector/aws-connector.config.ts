import type { RuntimeEnv } from "@cloudshield/config";
import type { AwsConnectorConfig } from "./aws-connector.types.js";

export function getAwsConnectorConfig(env: RuntimeEnv): AwsConnectorConfig {
  return {
    mode: env.AWS_CONNECTOR_MODE,
    region: env.AWS_REGION_DEFAULT,
    roleArn: env.AWS_ROLE_ARN,
    externalId: env.AWS_EXTERNAL_ID
  };
}
