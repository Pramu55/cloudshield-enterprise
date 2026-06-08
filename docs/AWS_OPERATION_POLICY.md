# AWS Operation Policy

This policy dictates the IAM permissions required.

## Scanner Trust Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "<CLOUDSHIELD_PRINCIPAL_ARN>" },
      "Action": "sts:AssumeRole",
      "Condition": { "StringEquals": { "sts:ExternalId": "<SCANNER_EXTERNAL_ID>" } }
    }
  ]
}
```

## Scanner Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeVolumes",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets"
      ],
      "Resource": "*"
    }
  ]
}
```

## Executor Trust Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "<CLOUDSHIELD_PRINCIPAL_ARN>" },
      "Action": "sts:AssumeRole",
      "Condition": { "StringEquals": { "sts:ExternalId": "<EXECUTOR_EXTERNAL_ID>" } }
    }
  ]
}
```

## Executor Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ec2:DescribeInstances",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "ec2:CreateTags",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "StringEquals": {
          "aws:ResourceTag/Environment": "sandbox",
          "aws:ResourceTag/CloudShieldManaged": "true"
        }
      }
    }
  ]
}
```

Do not add AdministratorAccess, PowerUserAccess, `ec2:*`, terminate, stop, start, delete, IAM mutation, S3 mutation or Terraform permissions.
