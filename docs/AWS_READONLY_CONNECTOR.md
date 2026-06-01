# AWS Read-Only Connector

`CLOUDSHIELD_READONLY_AWS_CONNECTOR_PLAN_GREEN` prepares the connector foundation without enabling full AWS inventory scanning.

## Configuration

Use `.env.example` as the shape only. Do not commit real AWS values.

```text
AWS_CONNECTOR_MODE=disabled
AWS_REGION_DEFAULT=us-east-1
AWS_ROLE_ARN=
AWS_EXTERNAL_ID=
```

Default mode is disabled and executes no AWS API calls.

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

## Credential Model

CloudShield should use IAM role assumption with an external ID for future read-only access. Long-lived AWS access keys are not recommended and must not be stored in CloudShield.

This milestone does not commit secrets, does not require AWS credentials by default, and never returns secrets through the API.

## Safety Boundary

- No AWS inventory scanner.
- No AWS mutation.
- No IAM, S3, EC2, Security Group, VPC, CloudTrail, KMS, or billing changes.
- No automatic remediation.
- No Terraform apply.
- No official compliance certification claims.

Compliance wording remains limited to CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.
