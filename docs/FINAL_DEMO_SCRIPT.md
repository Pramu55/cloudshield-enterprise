# CloudShield Enterprise - Final Demo Script

This script is designed for walking an evaluator, interviewer, or client through the CloudShield platform.

## 1. Landing Page / Login
**Action**: Open `http://localhost:3100/login`
**Script**: "Welcome to CloudShield. This is an enterprise-grade AWS governance foundation. It operates entirely locally for this demo. I'll log in using the demo evaluator account, which has tenant-isolated access to our sample organization."

## 2. Executive Dashboard
**Action**: Land on `http://localhost:3100/dashboard`
**Script**: "This is the Executive Dashboard. It provides a high-level view of our cloud posture, including AWS account coverage, resource inventory, high-risk findings, compliance readiness, and governed operations. CloudShield can coordinate remediation planning and approvals while AWS mutations and automated remediations remain intentionally disabled."

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
**Script**: "For executive reporting and audit preparation, we have the Reports Foundation. Reports include posture evidence, risk workflow state, remediation plans, approvals, and audit activity. Current exports are internal JSON previews, not official audit reports."

## 8.5 Governed Operations
**Action**: Navigate to "Governance".
**Script**: "This is where CloudShield becomes an operations platform. An analyst can create a remediation plan from a finding, request approval, approve or reject the plan, and mark manual completion. The platform records every step in the audit trail, but it does not execute AWS mutation or Terraform apply."

## 8.6 Premium Workspace Experience
**Action**: Move through Dashboard, Accounts, Inventory, Security, Governance, Compliance, Reports, Recommendations, Scans, and Settings.
**Script**: "The inner console is now structured like a real enterprise product. Each workspace has a command-center hero, status visuals, workflow panels, timelines, detail areas, and action surfaces. This is not just a color refresh; the dashboard content has been redesigned around operator tasks."

## 9. Scans & Real AWS Validation
**Action**: Navigate to "Scans" or "Accounts". Show the confirmation modals and validation banners.
**Script**: "A core architectural principle of CloudShield is safety. We have implemented a live read-only connection validation path using STS GetCallerIdentity and an EC2 describing scanner. When you trigger validation or scan, a confirmation modal warns you first. In the default disabled mode, the button is safely blocked and reports `awsApiCallExecuted=false`. When configured via environment settings, it performs live, secure, non-mutating checks."

## 10. Enterprise Production Roadmap
**Action**: Conclude the demo.
**Script**: "While this is a robust foundation, our future roadmap includes FinOps cost governance integrations, real-time EventBridge listeners for live inventory updates, and enterprise SSO integrations like Okta. This architecture proves out the difficult parts of tenant isolation, deterministic rule evaluation, and safe cloud governance."


**Note**: A premium public landing page is now available at / which guides users into the console login flow (/login), highlighting platform capabilities and safety constraints without claiming official compliance or real client deployments.

## Dynamic Operations Demo Flow

1. Open `/dashboard` and show live module status, operations timeline, and refresh timestamp.
2. Open `/dashboard/graph` and explain that the relationship graph is built from CloudShield DB records only.
3. Open `/dashboard/inventory`, select a resource, and show linked relationships, findings, plans, and evidence.
4. Open `/dashboard/scans` and show blocked scanner readiness plus scan lifecycle states.
5. Open `/dashboard/governance` and show approval workflow activity.
6. Open `/dashboard/reports` and show evidence summary plus internal preview reports.
7. State clearly that AWS credentials are not configured and no AWS API, scanner, mutation, Terraform apply, or automatic remediation was run.
## AI Automation Demo Addendum

Open `/dashboard/automation` and click `Run CloudShield Automated Assessment`.

Narrate:

- CloudShield checks credential readiness without showing secrets.
- AWS execution is blocked in evaluation mode.
- The Intelligence Engine still analyzes DB-backed inventory, findings, compliance controls, cost signals, and governance records.
- The assessment creates a persisted event timeline, executive summary, top risks, compliance gaps, FinOps opportunities, advisory remediation drafts, and an internal report preview.
- Safety flags remain false for AWS mutation, scanner execution in disabled mode, Terraform apply, and automatic remediation.
