# AWS Scanner Role Policy

Status: least-privilege template, not applied by this repository.

The scanner role is used for STS identity validation and read-only EC2 inventory. It must not allow mutations.

## Permission Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudShieldIdentityValidation",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    },
    {
      "Sid": "CloudShieldEc2ReadonlyInventory",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeRegions",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeInstances",
        "ec2:DescribeVolumes",
        "ec2:DescribeTags"
      ],
      "Resource": "*"
    }
  ]
}
```

## Trust Policy Shape

Replace the principal placeholder in AWS. Do not put the real External ID in Git.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::<cloudshield-runtime-account-id>:role/<cloudshield-runtime-role>"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "<configured-outside-git>"
        },
        "StringLike": {
          "sts:RoleSessionName": "cloudshield-*"
        }
      }
    }
  ]
}
```

Do not attach `AdministratorAccess`, `PowerUserAccess`, `ReadOnlyAccess`, or `ec2:*`.
