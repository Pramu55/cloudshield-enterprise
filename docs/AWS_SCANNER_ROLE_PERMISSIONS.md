# AWS Scanner Role Permissions

Attach this permissions policy to the scanner role in the dedicated non-production sandbox account.

The current CloudShield scanner implementation supports STS identity validation and EC2 read-only inventory. It must not have mutation permissions.

Allowed APIs:

- `sts:GetCallerIdentity`
- `ec2:DescribeRegions`
- `ec2:DescribeInstances`
- `ec2:DescribeVpcs`
- `ec2:DescribeSubnets`
- `ec2:DescribeSecurityGroups`
- `ec2:DescribeVolumes`

Template:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowScannerIdentityCheck",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    },
    {
      "Sid": "AllowEc2ReadOnlyInventoryInApprovedRegion",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeRegions",
        "ec2:DescribeInstances",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeVolumes"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "<APPROVED_REGION>"
        }
      }
    }
  ]
}
```

Notes:

- EC2 Describe APIs generally require `"Resource": "*"`. The region condition is the tightest practical scope for these actions.
- Use one or more approved regions only if CloudShield `AWS_ALLOWED_REGIONS` and the registered account regions also contain those regions.
- Do not add `ec2:CreateTags`, `ec2:DeleteTags`, instance lifecycle actions, security-group mutation, IAM mutation, S3 mutation, VPC mutation, volume deletion, arbitrary CLI, or Terraform permissions to the scanner role.
- Stop validation if this role can mutate AWS resources.
