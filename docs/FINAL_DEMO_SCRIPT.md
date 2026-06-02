# CloudShield Enterprise - Final Demo Script

This script is designed for walking an evaluator, interviewer, or client through the CloudShield platform.

## 1. Landing Page / Login
**Action**: Open `http://localhost:3100/login`
**Script**: "Welcome to CloudShield. This is an enterprise-grade AWS governance foundation. It operates entirely locally for this demo. I'll log in using the demo evaluator account, which has tenant-isolated access to our sample organization."

## 2. Executive Dashboard
**Action**: Land on `http://localhost:3100/dashboard`
**Script**: "This is the Executive Dashboard. It provides a high-level view of our cloud posture, including AWS account coverage, resource inventory, high-risk findings, and compliance readiness. Notice the safety banner at the top—CloudShield is designed with a strict read-only model. Mutations and automated remediations are intentionally disabled."

## 3. AWS Accounts Registry
**Action**: Navigate to "AWS Accounts" in the sidebar.
**Script**: "Here we manage our tenant-scoped AWS environments. In a production rollout, this is where cross-account IAM roles are registered for the read-only connector."

## 4. Resource Inventory
**Action**: Navigate to "Inventory".
**Script**: "This acts as our CMDB (Configuration Management Database). It provides a centralized, queryable database of all cloud assets discovered across the registered AWS accounts."

## 5. Security Posture Rules
**Action**: Navigate to "Security Posture".
**Script**: "Instead of just listing vulnerabilities, CloudShield uses a deterministic rules engine. It evaluates the inventory against best practices, identifying things like publicly exposed EC2 instances or unrestricted Security Groups."

## 6. Risk Workflow
**Action**: Show the Risk/Security findings list.
**Script**: "Governance requires workflow. When a finding is generated, teams can assign ownership, evaluate the business impact, and track risk acceptance. This moves security from an alert-list to an actionable process."

## 7. Compliance Evidence Center
**Action**: Navigate to "Compliance".
**Script**: "Here, security findings are mapped directly to internal governance frameworks. We use CIS-inspired and SOC2-inspired controls to demonstrate how technical findings translate into audit evidence."

## 8. Reports & Exports
**Action**: Navigate to "Reports".
**Script**: "For executive reporting and audit preparation, we have the Reports Foundation. This allows teams to preview and eventually export PDF or CSV snapshots of their compliance and posture evidence."

## 9. Scans & Safety Boundaries
**Action**: Navigate to "Scans" or "Settings".
**Script**: "A core architectural principle of CloudShield is safety. The AWS scanner is completely disabled by default in this release. There is zero code included for mutating AWS state or applying Terraform. This makes it a perfectly safe platform for enterprise evaluation."

## 10. Enterprise Production Roadmap
**Action**: Conclude the demo.
**Script**: "While this is a robust foundation, our future roadmap includes FinOps cost governance integrations, real-time EventBridge listeners for live inventory updates, and enterprise SSO integrations like Okta. This architecture proves out the difficult parts of tenant isolation, deterministic rule evaluation, and safe cloud governance."
## AWS Credential Readiness Demo Step

Show the AWS Account Governance and Settings pages. Point out:

- Role-based setup is preferred.
- Access keys are optional local-development fallback indicators only.
- No secret input fields are shown.
- No credentials are stored in CloudShield DB.
- Scanner execution remains disabled by default.
- No AWS mutation, Terraform apply, or automatic remediation is available.
