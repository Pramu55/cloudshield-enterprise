# Compliance Evidence Center

CloudShield's Compliance Evidence Center is a foundation for internal cloud governance evidence. It maps existing CloudShield records into reviewable evidence for CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.

This milestone does not claim official CIS or SOC2 certification. It does not claim any real customer deployment. It does not run AWS scans, call AWS inventory APIs, mutate AWS, execute remediation, or run Terraform apply.

## Evidence Sources

Evidence is generated from organization-scoped CloudShield database records:

- `SecurityFinding` records for security posture evidence
- `CostFinding` records for FinOps and tagging evidence
- `RiskAcceptance` records for business justification and expiry evidence
- `AuditEvent` records for workflow history
- `Recommendation` records for non-executable remediation planning evidence

Every compliance evidence response returns safety metadata:

- `officialCertificationClaim=false`
- `awsApiCallExecuted=false`
- `mutationExecuted=false`
- `remediationExecuted=false`
- `generatedFromCloudShieldRecordsOnly=true`

## Initial Control Catalog

CIS-inspired controls:

- `CIS-NETWORK-001`: Public SSH exposure should be restricted
- `CIS-NETWORK-002`: Public RDP exposure should be restricted
- `CIS-STORAGE-001`: Attached storage should use encryption at rest
- `CIS-TAGGING-001`: Cloud resources should include owner and environment tags

SOC2-inspired evidence:

- `SOC2-ACCESS-001`: Access governance evidence should be reviewable
- `SOC2-CHANGE-001`: Remediation planning and risk decisions should be auditable
- `SOC2-MONITORING-001`: Cloud risk findings should have evidence and lifecycle state

Internal cloud governance evidence:

- `INT-RISK-001`: High-risk findings require ownership
- `INT-RISK-002`: Risk acceptance requires business justification and expiry
- `INT-COST-001`: Cost ownership tags should be present

## API Routes

Protected routes derive organization scope from the authenticated token:

```text
GET /api/v1/compliance/evidence-center
GET /api/v1/compliance/controls
GET /api/v1/compliance/controls/:controlId
POST /api/v1/compliance/evaluate
GET /api/v1/compliance/evidence
GET /api/v1/compliance/export/preview
```

`POST /api/v1/compliance/evaluate` recalculates evidence from CloudShield records only. It does not trigger AWS scanning and does not execute cloud changes.

## Future Scope

Future phases can add richer evidence exports, approval workflow, evidence retention policies, RBAC-backed reviewer roles, SIEM/ticketing integrations, and client-ready onboarding workflows. Real AWS inventory evidence should only be introduced after an approved read-only scanner milestone with explicit API allowlists and safety validation.
