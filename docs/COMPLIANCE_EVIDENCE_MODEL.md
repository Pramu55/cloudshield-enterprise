# Compliance Evidence Model

CloudShield supports compliance-style evidence workflows without claiming official certification.

## Evidence Types

- CIS-inspired controls
- SOC2-inspired evidence
- Internal cloud governance evidence

## Status Model

- `PASS`: evidence indicates control expectation is met.
- `FAIL`: evidence indicates control expectation is not met.
- `WARNING`: evidence is incomplete, stale, or needs review.

## Evidence Records

Evidence should include:

- Control id
- Evidence type
- Source
- Status
- Collection timestamp
- Related account or resource
- Safe metadata

Evidence must not include secrets, session tokens, or credential material.

## Export Model

Future exports may include:

- Executive summary
- Security posture report
- Cost governance report
- Compliance evidence report
- JSON export for downstream review

Exports should clearly identify sample/demo data when used in local demos.

## What Is Not Claimed

CloudShield does not claim official CIS certification, SOC2 certification, audit sign-off, or production client deployment. It provides internal cloud governance evidence and compliance-inspired control mapping.


---
### Security Posture Rules Foundation Note
* Security rules are strictly deterministic.
* Rules evaluate stored CloudShield inventory records only.
* No AWS scan is triggered by rule evaluation.
* No AWS mutation is executed.
* No automatic remediation is performed.
* Findings contain evidence and business impact.
* Compliance mapping is CIS-inspired/SOC2-inspired/internal only.
* Sample/demo data remains clearly labeled.
## Evidence Center Upgrade

The compliance evidence model now includes a dedicated evidence center foundation. Controls include framework, control code, objective, category, severity, status, finding count, evidence count, failed resources, and last evaluation time.

Evidence records include source type, source id, summary, evidence JSON, confidence, notes, sample/demo labeling, and organization scope.

Allowed language remains:

- CIS-inspired controls
- SOC2-inspired evidence
- internal cloud governance evidence

CloudShield does not claim official CIS/SOC2 certification. Compliance evaluation generates evidence from CloudShield records only and does not trigger AWS scans or AWS changes.

## Report Preview Usage

Compliance evidence can be summarized in report previews for enterprise demo/evaluation workflows. Report previews do not create official audit reports, do not claim official certification, and do not trigger AWS scans or AWS changes.
