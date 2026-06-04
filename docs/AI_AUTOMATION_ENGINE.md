# CloudShield AI Automation Engine

Milestone: `CLOUDSHIELD_AI_AUTOMATION_AND_INTELLIGENCE_FOUNDATION_GREEN`

CloudShield now includes an AI-assisted deterministic automation layer called the CloudShield Intelligence Engine. It orchestrates assessment workflow from credential readiness through risk prioritization, compliance mapping, advisory remediation planning, and internal report generation.

This engine does not call external AI APIs. Current intelligence output is deterministic and generated from tenant-scoped CloudShield database records.

## What The Engine Does

- checks environment-only AWS readiness without returning secret values
- blocks AWS execution when connector/scanner modes are disabled
- optionally allows STS identity validation only when explicitly configured
- keeps read-only inventory scanning behind explicit scanner mode gates
- prioritizes risks by severity, account criticality, environment, business unit, and resource blast radius
- summarizes compliance gaps and FinOps opportunities
- creates advisory remediation plan drafts for human approval
- creates automation events and audit events
- creates an internal automated assessment report preview
- creates an intelligence summary for dashboards

## Safety Boundaries

The engine never performs AWS mutation, Terraform apply, automatic remediation execution, resource deletion, IAM changes, S3 changes, EC2 changes, or security group changes.

Safety flags are returned by automation endpoints:

- `awsApiCallExecuted`
- `scannerRun`
- `mutationExecuted=false`
- `terraformApplyExecuted=false`
- `automaticRemediationExecuted=false`

In the default local mode, both `awsApiCallExecuted` and `scannerRun` remain `false`.

## Modes

`EVALUATION`: AWS execution is blocked. The engine analyzes DB/sample records and still produces summaries, evidence, remediation drafts, and report records.

`AWS_STS_ONLY`: Only STS identity validation is eligible, and only when connector mode and environment readiness allow it.

`AWS_READONLY_SCAN`: Future guarded mode for approved read-only inventory orchestration. Mutation remains disabled.

## Operator Workflow

The operator only needs to configure safe AWS environment variables when real validation is desired, open CloudShield, and click `Run CloudShield Automated Assessment`.

The generated output remains advisory and approval-based.
# Inventory Sync Interaction

`Run CloudShield Assessment` remains advisory and governed. It may show an inventory sync step, but the step is blocked unless read-only mode is explicitly enabled. In disabled mode the assessment continues with CloudShield database evaluation and reports `scannerRun=false`.

Automation never runs Terraform apply, never executes remediation, and never mutates AWS resources. Read-only inventory evidence is included in reports only after a successful explicit `/inventory/sync` run.
