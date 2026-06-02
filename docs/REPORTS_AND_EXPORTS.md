# Reports And Exports

CloudShield's Reports and Evidence Export Center provides safe report previews for enterprise cloud governance conversations. Reports are generated from CloudShield database records only and are intended for consulting/client demo ready evaluation workflows.

This milestone does not generate official audit reports, does not claim official CIS/SOC2 certification, does not claim real client deployment, and does not claim real AWS inventory data while scanning remains disabled.

## Report Types

- `EXECUTIVE_POSTURE_SUMMARY`
- `SECURITY_FINDINGS_SUMMARY`
- `COMPLIANCE_EVIDENCE_SUMMARY`
- `RISK_WORKFLOW_SUMMARY`
- `AWS_ACCOUNT_GOVERNANCE_SUMMARY`
- `COST_GOVERNANCE_SUMMARY`

## Data Sources

Report previews are computed from existing organization-scoped CloudShield records:

- AWS account registry metadata
- Inventory records already stored in CloudShield
- Security findings
- Cost findings
- Compliance controls and evidence
- Risk acceptance records
- Audit events
- Non-executable recommendations
- Report export records

## Safety Boundary

Every report response includes:

- `generatedFromCloudShieldRecordsOnly=true`
- `officialAuditReportClaim=false`
- `officialCertificationClaim=false`
- `awsApiCallExecuted=false`
- `mutationExecuted=false`
- `remediationExecuted=false`
- `sampleData=true`

Report generation does not trigger AWS scans, does not call AWS inventory/list APIs, does not mutate AWS, does not execute automatic remediation, and does not run Terraform apply.

## API Routes

Protected routes derive tenant scope from the authenticated organization:

```text
GET /api/v1/reports
GET /api/v1/reports/summary
POST /api/v1/reports/preview
POST /api/v1/reports/generate
GET /api/v1/reports/:reportId
GET /api/v1/reports/:reportId/export-preview
```

`POST /api/v1/reports/generate` creates a `ReportExport` record containing JSON summary data only. Binary PDF, CSV, signed evidence packs, scheduled reports, and external storage delivery are future scope.

## Future Scope

Future phases may add:

- PDF and CSV exports
- Signed evidence packs
- Scheduled reports
- Report approval workflow
- Evidence retention policy
- Client-ready onboarding workflow
- RBAC-controlled export permissions
- SIEM/ticketing delivery integrations
