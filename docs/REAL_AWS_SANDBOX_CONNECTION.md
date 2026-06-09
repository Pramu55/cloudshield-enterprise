# Real AWS Sandbox Connection

This documentation explains how the sandbox environment uses AWS credentials safely without exposing secrets.

## Environment Setup
Credentials are strictly managed via the locally ignored `.env` file at the root.

Supported variables:
- `AWS_CONNECTOR_MODE=sts-validation`
- `AWS_ROLE_ARN=arn:aws:iam::...:role/CloudShieldScanner`
- `AWS_EXTERNAL_ID=...`
- `AWS_EXECUTOR_ROLE_ARN=arn:aws:iam::...:role/CloudShieldExecutor`
- `AWS_EXECUTOR_EXTERNAL_ID=...`

## Safety
This is a sandbox validation connection, not production readiness.
Never commit `.env` or any AWS credentials.
Tokens are short-lived.
