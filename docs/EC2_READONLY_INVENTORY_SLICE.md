# EC2 Read-Only Inventory Slice

CloudShield has implemented an initial EC2 read-only inventory scanner slice.

## Overview
This milestone introduces the technical foundation for AWS EC2 read-only scanning, while ensuring CloudShield's enterprise-grade safety properties remain intact.

## Scanner Mode
The scanner uses `process.env.AWS_INVENTORY_SCANNER_MODE`.
By default, this is set to `disabled` to ensure no AWS scanning is performed out-of-the-box.
When configured to `readonly-scan`, the worker will perform read-only API calls to gather EC2, EBS, VPC, Subnet, and Security Group inventory data.

## Allowed APIs
* `sts:GetCallerIdentity`
* `ec2:DescribeInstances`
* `ec2:DescribeSecurityGroups`
* `ec2:DescribeVolumes`
* `ec2:DescribeVpcs`
* `ec2:DescribeSubnets`

## Blocked Mutation Patterns
All mutation APIs are strictly blocked.
* `Create*`
* `Update*`
* `Delete*`
* `Put*`
* `Attach*`
* `Detach*`
* `Start*`
* `Stop*`
* `Terminate*`
* `Reboot*`
* `Modify*`
* `Authorize*`
* `Revoke*`
* `Terraform apply`

## Safety First
* Default configuration disables the scanner.
* The frontend clearly labels sample/demo data to prevent confusion regarding scanning status.
* The worker strictly checks `process.env` directly, ignoring unverified configuration payloads.


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
