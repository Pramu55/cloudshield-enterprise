import type { RuntimeEnv } from "@cloudshield/config";
import type { AwsCredentialReadiness } from "@cloudshield/contracts";

const recommendedEnvKeys = [
  "AWS_REGION",
  "AWS_ROLE_ARN",
  "AWS_CONNECTOR_MODE",
  "AWS_INVENTORY_SCANNER_MODE"
];

export function getAwsCredentialReadiness(
  config: RuntimeEnv,
  source: NodeJS.ProcessEnv = process.env
): AwsCredentialReadiness {
  const awsRegionConfigured = Boolean(
    source.AWS_REGION || source.AWS_REGION_DEFAULT || config.AWS_REGION_DEFAULT
  );
  const awsRoleArnConfigured = Boolean(source.AWS_ROLE_ARN || config.AWS_ROLE_ARN);
  const awsExternalIdConfigured = Boolean(source.AWS_EXTERNAL_ID || config.AWS_EXTERNAL_ID);
  const awsAccountIdConfigured = Boolean(source.AWS_ACCOUNT_ID);
  const awsAccessKeyIdConfigured = Boolean(source.AWS_ACCESS_KEY_ID);
  const awsSecretAccessKeyConfigured = Boolean(source.AWS_SECRET_ACCESS_KEY);
  const awsSessionTokenConfigured = Boolean(source.AWS_SESSION_TOKEN);
  const roleBasedReadiness = awsRegionConfigured && awsRoleArnConfigured;
  const localAccessKeyFallbackDetected =
    awsAccessKeyIdConfigured && awsSecretAccessKeyConfigured;
  const missingEnvKeys = recommendedEnvKeys.filter((key) => {
    if (key === "AWS_REGION") {
      return !source.AWS_REGION && !source.AWS_REGION_DEFAULT;
    }

    if (key === "AWS_ROLE_ARN") {
      return !awsRoleArnConfigured;
    }

    if (key === "AWS_CONNECTOR_MODE") {
      return !source.AWS_CONNECTOR_MODE;
    }

    if (key === "AWS_INVENTORY_SCANNER_MODE") {
      return !source.AWS_INVENTORY_SCANNER_MODE;
    }

    return false;
  });

  const stsValidationAvailable =
    config.AWS_CONNECTOR_MODE === "readonly-validation" && roleBasedReadiness;
  const inventoryScanAvailable =
    config.AWS_INVENTORY_SCANNER_MODE === "readonly-scan" && roleBasedReadiness;

  return {
    connectorMode: config.AWS_CONNECTOR_MODE,
    scannerMode: config.AWS_INVENTORY_SCANNER_MODE,
    requiredEnvPresent: missingEnvKeys.length === 0,
    missingEnvKeys,
    awsRegionConfigured,
    awsRoleArnConfigured,
    awsExternalIdConfigured,
    awsAccountIdConfigured,
    awsAccessKeyIdConfigured,
    awsSecretAccessKeyConfigured,
    awsSessionTokenConfigured,
    roleBasedReadiness,
    localAccessKeyFallbackDetected,
    awsConnectorMode: config.AWS_CONNECTOR_MODE,
    awsInventoryScannerMode: config.AWS_INVENTORY_SCANNER_MODE,
    credentialStorageMode: "environment-only",
    secretManagerRecommended: true,
    stsValidationAvailable,
    inventoryScanAvailable,
    mutationEnabled: false,
    terraformApplyEnabled: false,
    remediationExecutionEnabled: false,
    awsApiCallExecuted: false,
    message:
      "AWS credential readiness inspects environment variable presence only. No secret values are returned, no AWS API call is executed, and CloudShield does not store credentials."
  };
}
