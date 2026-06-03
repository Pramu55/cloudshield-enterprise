# CloudShield Production-Like Platform Polish

CloudShield is a modern, enterprise-ready cloud governance, posture analysis, and compliance evidence platform. This document highlights how CloudShield functions as an original, production-ready governance foundation and details its technical security boundaries, local evaluator modes, and credential enablement plan.

## 1. Original Visual Identity
Unlike typical sandbox tools that copy Microsoft Azure or AWS interfaces pixel-by-pixel, CloudShield features its own **original, enterprise-grade console design**:
* **Theme**: Deep slate top header controls (`#0f172a`), clean slate canvas background (`#f8fafc`), and a modern white-panel layout with custom Indigo (`#4f46e5`) and Teal (`#0d9488`) signal colors.
* **Layout**: Organized around left sidebar navigation groups, custom action command bars, collapsible detail blades, and clear safety status banners.
* **Typography & Corners**: Styled with standard system font stacks (no external web CDNs/imports) and smooth, professional corner radii (6px/8px) to establish a distinct, modern identity.

## 2. Safe Local-Evaluator Sandbox
CloudShield is designed to be consulting/client-evaluation ready from the moment it is launched. To ensure absolute safety during demonstrations and audits:
* **Database-Backed**: All resources, findings, recommendations, and evidence items are read directly from the CloudShield PostgreSQL database.
* **AWS Execution Gates**: All direct scanner requests and live AWS SDK calls are disabled. No live AWS APIs are reached, and no AWS mutations, remediations, or Terraform applies are executed.
* **Visible Sample Labels**: Keep clear `sample/demo data` labels on interactive pages to alert evaluators that live scans remain inactive until configurations are enabled.

## 3. Credential Enablement Path
CloudShield is architected to transition to live read-only AWS operations with only two configuration steps:
1. **Provision IAM Role**: Deploy a read-only AWS IAM Role in your target account with a Trust Policy matching the CloudShield External ID.
2. **Configure Environment Variables**: Supply the IAM Role ARN and Region via secure environment variables (`AWS_ROLE_ARN`, `AWS_REGION`). Enable read-only scanning mode by setting `AWS_INVENTORY_SCANNER_MODE=readonly-scan` and `AWS_CONNECTOR_MODE=readonly-validation`.

```
                        +----------------------------+
                        |  CloudShield Service Shell |
                        +--------------+-------------+
                                       | (1) Read config
                                       v
                        +--------------+-------------+
                        | Environment variables only |
                        | (No DB secret storage)     |
                        +--------------+-------------+
                                       | (2) Assume Role
                                       v
                        +--------------+-------------+
                        |  AWS STS / Read-Only APIs  |
                        +----------------------------+
```

## 4. Production Security Model
* **Credential Safety**: CloudShield never requests or stores raw AWS access keys or secrets in the database. Credentials reside purely within the container runtime environment or secure cloud secret managers.
* **Strict Read-Only Posture**: Operational boundaries prevent mutations. Write/delete calls on AWS resource families are blocked at the code engine level.
* **Governance Framework**: All compliance metrics are labeled as "CIS-inspired" or "SOC2-inspired" internal evidence to avoid misleading certification claims.
