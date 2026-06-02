# AWS Credential Enablement Plan

This document outlines the strict safety boundaries and future enablement path for connecting CloudShield Enterprise to real AWS environments.

## 1. No Committed Credentials
**CRITICAL**: Under no circumstances should AWS credentials, Access Keys, Secret Keys, or API tokens be committed to source control. The platform does not, and will never, include functionality to store plaintext AWS keys in the database.

## 2. Local Development Model
In local evaluator mode, credentials can *only* be provided via temporary local environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`). The `.env` file must always be excluded via `.gitignore`. 

## 3. Production Enablement Model
For production deployments, the platform architecture assumes a completely credential-less execution environment:
- If hosted on ECS/EKS: Task Execution Roles.
- If hosted on EC2: Instance Profiles.
The backend will use the default AWS SDK credential provider chain to assume IAM roles. Cross-account access will be managed by assuming read-only roles into target tenant accounts, strictly via AWS STS (`AssumeRole`).

## 4. Controlled Scanner Rollout
Even when credentials are provided in the environment, the scanner remains disabled by default. 
- It must be explicitly enabled via backend configuration flags.
- The rollout path involves reading metadata only (EC2 instances, Security Groups, IAM Roles) using `Describe*` and `List*` actions.

## 5. Strict Zero-Mutation Policy
CloudShield enforces a strict zero-mutation policy. 
- There are no IAM policies attached to the scanner role that allow `Create`, `Update`, `Put`, or `Delete` actions.
- There is no code in the application capable of mutating AWS resources or applying Terraform.
- Automatic remediation is intentionally out of scope to ensure the platform can be safely deployed in highly regulated enterprise environments without risk of destructive actions.
## Corrected Read-Only Credential Readiness Model

CloudShield does not make `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` mandatory. Enterprise readiness should prefer role-based setup:

- `AWS_REGION`
- `AWS_ROLE_ARN`
- `AWS_CONNECTOR_MODE`
- `AWS_INVENTORY_SCANNER_MODE`

Optional local-development fallback indicators:

- `AWS_EXTERNAL_ID`
- `AWS_ACCOUNT_ID`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`

The readiness API inspects environment variable presence only and returns booleans. It never returns secret values, never stores credentials in the database, never logs credentials, and does not call AWS.
