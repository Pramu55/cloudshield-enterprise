# Evaluator Quickstart

Welcome to the CloudShield Enterprise evaluation environment. This guide will walk you through exploring the platform's capabilities safely using local sample data.

## Getting Started

1. **Run the Local Runtime**
   Ensure Docker is running, then start the platform:
   ```bash
   pnpm install
   pnpm cloudshield start
   ```

2. **Login**
   Navigate to `http://localhost:3100/login` and use the demo credentials:
   * **Email:** `demo@cloudshield.local`
   * **Password:** `CloudShieldDemo123!`

## Demo Route Walkthrough

We recommend exploring the platform in the following order:

1. **Executive Posture (`/dashboard`)**
   Start here to see the high-level overview. Note the safety disclaimers and the clear labeling of sample/demo data. This page demonstrates the executive view of AWS account governance and risk.

2. **AWS Accounts (`/dashboard/accounts`)**
   View the multi-account registry. You can add a placeholder account to see the validation workflow (which safely stops short of actual AWS API execution).

3. **Inventory (`/dashboard/inventory`)**
   Explore the tracked AWS resources. These are sample records stored in the CloudShield database. 

4. **Security Posture (`/dashboard/security`)**
   Click "Evaluate Security Rules" to run the deterministic rules engine. Notice how fast it is—it evaluates stored DB records, not live AWS environments.

5. **Risk Workflow (`/dashboard/risk`)**
   *(Note: Risk findings are integrated into the security and compliance views.)*

6. **Compliance Evidence (`/dashboard/compliance`)**
   See how security findings map to internal governance frameworks (CIS-inspired and SOC2-inspired). This demonstrates evidence tracking for audits without claiming official certification.

7. **Reports & Exports (`/dashboard/reports`)**
   Generate a preview report. This highlights the platform's ability to export governance data for offline review and executive summaries.

## Safety Note
The platform is intentionally running in a "disabled" state regarding live AWS connectivity. You will see labels indicating "Scanner Disabled" and "No AWS mutation". This is a feature of the demo environment to guarantee safety during evaluation.
