# Screenshot & Media Checklist

Capture the following screenshots to build out the portfolio case study, README, and demonstration materials.

## Safety Rule
**CRITICAL**: Do not show secrets, `.env` file contents, API tokens, AWS credentials, database URLs, or private customer/client data in ANY screenshots. Ensure the environment is strictly using the sample/demo evaluator mock data before capturing.

## Required Screenshots

### 1. Landing & Auth
- [ ] **Landing Page**: Showing the initial platform value proposition.
- [ ] **Login Page**: Showing the tenant-scoped authentication boundary.

### 2. Dashboard
- [ ] **Executive Dashboard**: Full page view showing the metrics grid, safety status, and demo-freeze header.

### 3. Core Modules
- [ ] **Accounts Page**: Showing the AWS account registry and read-only connector status.
- [ ] **Inventory Page**: Demonstrating the CMDB resource table.
- [ ] **Security Posture**: Showing the deterministic rules engine output and high-risk findings.
- [ ] **Risk Workflow**: Displaying the risk ownership and acceptance workflow for a specific finding.
- [ ] **Compliance Evidence Center**: Demonstrating the mapping of findings to CIS-inspired and SOC2-inspired controls.
- [ ] **Reports Page**: Showing the report export preview foundation.
- [ ] **Scans Page**: Showing the background scanning status (with disabled state visible).

### 4. Configuration & Safety
- [ ] **Settings / Safety Status**: Showing the disabled state of AWS mutation and automatic remediation.

### 5. Technical Context
- [ ] **GitHub Repo README**: Showing the clean project structure and architecture documentation.
- [ ] **Runtime Status Terminal**: Showing the `pnpm cloudshield status` or `docker compose ps` output to prove deterministic local containerization.
