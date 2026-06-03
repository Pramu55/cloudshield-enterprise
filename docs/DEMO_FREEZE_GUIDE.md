# CloudShield Enterprise Demo Freeze Guide

CloudShield is currently in the `CLOUDSHIELD_PRODUCTION_READINESS_AND_ORIGINAL_PLATFORM_POLISH_GREEN` milestone. This ensures the platform is safe, stable, and ready for client evaluations, consulting demos, and architectural reviews.

## What is Implemented
* **Original Platform Console UI**: A professional Indigo/Teal layout console designed for cloud governance conversations, featuring rounded cards and dynamic dashboards.
* **AWS Account Registry**: Organization-scoped AWS account metadata tracking with credential readiness status.
* **Security Rules Engine**: Deterministic rule evaluation against stored database inventory records.
* **Risk Workflow**: Tracking open, acknowledged, and accepted risks.
* **Compliance Evidence Center**: Mapping findings to CIS-inspired and SOC2-inspired internal governance controls.
* **Reports and Exports**: Generation of executive, security, and compliance summaries from CloudShield records.

## What is Intentionally Disabled (Safety Boundaries)
For evaluator and demo safety, the following high-risk capabilities are strictly disabled and blocked at the API/worker level:
* **Live AWS API Calls**: The platform cannot make live AWS API calls beyond a basic STS validation test.
* **AWS Inventory Scanner**: Execution of the read-only scanner plan is blocked.
* **AWS Mutation**: There is zero code to create, modify, or delete AWS resources.
* **Automatic Remediation**: Remediation execution is hard-blocked by policy.
* **Terraform Apply**: Terraform functionality is limited to theoretical read-only analysis.

## Evaluator Copy / Messaging Rules
* **Sample Data**: Explain that all data visible in the dashboard is sample/demo data intended to showcase the workflow. 
* **CloudShield Records**: Emphasize that reports and evaluations run only against stored CloudShield records, ensuring no unintended AWS interaction.
* **No Official Certification**: Clarify that CloudShield provides compliance *evidence* for internal governance (CIS-inspired, SOC2-inspired) but does not claim or provide official certification.
* **No Real Client Claims**: Do not claim CloudShield is deployed to a specific named client (e.g., Accenture) in production. It is built for *enterprise-company deployment readiness*.

## Production Roadmap
The path to production involves adding AWS credentials in environment variables, enabling the read-only connector, safely rolling out the read-only inventory scanner, and gradually introducing enterprise SSO and RBAC. See `ROADMAP.md` for details.
