# AWS Executor Role Policy

Status: least-privilege template for the sandbox tagging pilot.

The executor role is separate from the scanner role. It is used only after simulation, approval, exact confirmation, queue delivery, and worker preflight.

## Allowed Mutation

Only this operation is in scope:

- `EC2_APPLY_GOVERNANCE_TAGS`

No EC2 stop, terminate, reboot, security-group modification, IAM modification, S3 mutation, KMS mutation, or Terraform apply is enabled.

## Permission Policy

Restrict `Resource` to the approved sandbox instance ARN where possible.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudShieldExecutorIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    },
    {
      "Sid": "CloudShieldExecutorPreflight",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudShieldGovernanceTagging",
      "Effect": "Allow",
      "Action": "ec2:CreateTags",
      "Resource": "arn:aws:ec2:<region>:<sandbox-account-id>:instance/<approved-instance-id>",
      "Condition": {
        "ForAllValues:StringEquals": {
          "aws:TagKeys": [
            "CloudShieldManaged",
            "CloudShieldOwner",
            "CloudShieldEnvironment",
            "CloudShieldReviewDate"
          ]
        }
      }
    },
    {
      "Sid": "CloudShieldGovernedTagRollback",
      "Effect": "Allow",
      "Action": "ec2:DeleteTags",
      "Resource": "arn:aws:ec2:<region>:<sandbox-account-id>:instance/<approved-instance-id>",
      "Condition": {
        "ForAllValues:StringEquals": {
          "aws:TagKeys": [
            "CloudShieldManaged",
            "CloudShieldOwner",
            "CloudShieldEnvironment",
            "CloudShieldReviewDate"
          ]
        }
      }
    }
  ]
}
```

`ec2:DeleteTags` is present only for separately approved rollback. CloudShield must not perform rollback automatically.

## Explicit Deny Review

The role must not include:

- `ec2:TerminateInstances`
- `ec2:StopInstances`
- `ec2:RebootInstances`
- `ec2:ModifyInstanceAttribute`
- `ec2:AuthorizeSecurityGroupIngress`
- `ec2:RevokeSecurityGroupIngress`
- `iam:*`
- `s3:*`
- `kms:*`
- `organizations:*`
- `ec2:*`

## Trust Policy Shape

Replace placeholders in AWS only. Do not commit the real External ID.

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
