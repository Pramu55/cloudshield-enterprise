# Screenshot & Demo Checklist

When preparing screenshots or conducting a live demo of CloudShield, ensure the following elements are clearly visible or addressed:

### 1. Safety and Context
- [ ] **Sample Data Banner:** The "Sample/demo data" notice is visible at the top of the dashboard.
- [ ] **No Execution Claim:** Wording indicating "No AWS changes are executed" or "Scanner disabled" is visible on the Dashboard and Settings pages.
- [ ] **Certification Disclaimer:** It is clear that compliance is "CIS-inspired" or "SOC2-inspired", not officially certified.

### 2. Core Workflows
- [ ] **Executive Dashboard:** Capture the primary metrics (Accounts, Inventory, Risks, Compliance).
- [ ] **Security Evaluation:** Capture the before/after of clicking "Evaluate Security Rules".
- [ ] **Compliance Mapping:** Capture the evidence center showing controls passing/failing based on finding data.
- [ ] **Report Generation:** Capture a generated report preview showing the safety metadata (e.g., `generatedFromCloudShieldRecordsOnly: true`).

### 3. Navigation and UX
- [ ] **Sidebar:** The collapsible sidebar is open in at least one screenshot to show full navigation context.
- [ ] **Fast Navigation:** During live demos, demonstrate the snappy client-side navigation between tabs.

### 4. What NOT to Show/Claim
- [ ] **No Live AWS Metrics:** Do not mock up fake CloudWatch graphs or live AWS billing data that looks too real.
- [ ] **No Real Client Logos:** Do not use Accenture or other real company logos in the demo tenant data.
- [ ] **No Mutation Buttons:** Do not show "Remediate Now" buttons unless they are clearly marked as disabled or "Review Only".
