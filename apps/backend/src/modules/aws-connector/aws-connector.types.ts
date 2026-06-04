import type {
  AwsConnectorMode,
  AwsConnectorStatusResponse,
  AwsReadonlyValidationStatus,
  AwsIdentityValidationResponse
} from "@cloudshield/contracts";

export type AwsConnectorConfig = {
  mode: AwsConnectorMode;
  region: string;
  roleArn: string;
  externalId: string;
};

export type AwsReadonlyValidationResult = {
  connector: AwsConnectorStatusResponse;
  status: AwsReadonlyValidationStatus;
  awsApiCallExecuted: boolean;
  callerIdentity: {
    account: string | null;
    arn: string | null;
    userId: string | null;
  } | null;
  message: string;
};

export type AwsIdentityValidationResult = AwsIdentityValidationResponse;
