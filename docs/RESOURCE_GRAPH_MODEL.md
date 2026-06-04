# CloudShield Resource Graph Model

The CloudShield resource graph is built from CloudShield database records, not live AWS API calls.

## Graph Inputs

- AWS account registry records
- Cloud resource records
- Resource relationship records
- Security findings linked to resources
- Remediation plans linked to findings
- Approval requests linked to remediation plans
- Audit events linked to governance targets
- Compliance evidence and report export records

## Graph Shape

The graph models relationships such as:

- AWS account -> resource
- VPC -> subnet
- subnet -> EC2 instance
- EC2 instance -> volume
- security group -> EC2 instance
- resource -> finding
- finding -> remediation plan
- remediation plan -> approval request
- target -> audit event
- audit event -> report evidence

## Safety Boundary

The graph endpoint is read-only and organization scoped. It returns explicit safety flags confirming that no AWS API call, scanner run, mutation, Terraform apply, or automatic remediation execution occurred.

## Demo Data

The local seed includes safe sample graph records for enterprise demo flow. These records are labeled as sample data and are intended to demonstrate topology, ownership, findings, governance, and evidence workflows before real AWS credentials are enabled.
