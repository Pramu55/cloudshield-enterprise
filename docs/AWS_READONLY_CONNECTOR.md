# AWS Read-Only Connector

`CLOUDSHIELD_AWS_READONLY_VALIDATION_GREEN` keeps the connector disabled by default and validates the safe STS-only identity validation path without enabling AWS inventory scanning.

In the enterprise blueprint milestone, this connector is positioned as one component of a larger AWS governance control plane. It remains disabled by default and must not be described as a full scanner.

## Configuration

Use `.env.example` as the shape only. Do not commit real AWS values.

```text
AWS_CONNECTOR_MODE=disabled
AWS_REGION_DEFAULT=us-east-1
AWS_ROLE_ARN=
AWS_EXTERNAL_ID=
```

Default mode is disabled and executes no AWS API calls.

The separate inventory scanner mode also defaults to disabled:

```text
AWS_INVENTORY_SCANNER_MODE=disabled
```

The scanner plan endpoint describes future read-only inventory APIs but does not execute them.

## Validation Scope

When explicitly configured with:

```text
AWS_CONNECTOR_MODE=readonly-validation
```

the only allowed AWS SDK call in this milestone is:

```text
sts:GetCallerIdentity
```

This validates the identity available to the runtime. It does not enumerate EC2, S3, IAM, Security Groups, VPCs, CloudTrail, KMS, or billing data.

The validation endpoint returns `awsApiCallExecuted=false` when the connector is disabled or not configured. It returns `awsApiCallExecuted=true` only after attempting STS `GetCallerIdentity` in explicitly enabled `readonly-validation` mode.

## Credential Model

CloudShield should use IAM role assumption with an external ID for future read-only access. Long-lived AWS access keys are not recommended and must not be stored in CloudShield.

This milestone does not commit secrets, does not require AWS credentials by default, and never returns secrets through the API.

## Safety Boundary

- No AWS inventory scanner.
- No EC2, S3, IAM, Security Group, EBS, VPC, RDS, Lambda, CloudTrail, KMS, or billing inventory API execution.
- No AWS mutation.
- No IAM, S3, EC2, Security Group, VPC, CloudTrail, KMS, or billing changes.
- No automatic remediation.
- No Terraform apply.
- No official compliance certification claims.

Compliance wording remains limited to CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.
