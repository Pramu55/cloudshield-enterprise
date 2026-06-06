# AWS Executor Role Permissions

Attach this permissions policy to the executor role in the dedicated non-production sandbox account.

The current CloudShield worker supports only the governed operation `EC2_APPLY_GOVERNANCE_TAGS` against an `AWS_SYNC` EC2 instance resource. The worker calls `ec2:CreateTags` during execution and uses read-only `ec2:DescribeInstances` to load and verify tag state. Rollback evidence currently preserves whether each affected tag should be restored with `ec2:CreateTags` or removed with `ec2:DeleteTags` after separate approval.

Allowed governance tag keys:

- `CloudShieldManaged`
- `CloudShieldOwner`
- `CloudShieldEnvironment`
- `CloudShieldReviewDate`

Template:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowVerifyTargetInstanceTags",
      "Effect": "Allow",
      "Action": "ec2:DescribeInstances",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "<APPROVED_REGION>"
        }
      }
    },
    {
      "Sid": "AllowCloudShieldGovernanceTagApply",
      "Effect": "Allow",
      "Action": "ec2:CreateTags",
      "Resource": "arn:aws:ec2:<APPROVED_REGION>:<SANDBOX_ACCOUNT_ID>:instance/*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "<APPROVED_REGION>"
        },
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
      "Sid": "AllowCloudShieldGovernanceTagRollbackRemoval",
      "Effect": "Allow",
      "Action": "ec2:DeleteTags",
      "Resource": "arn:aws:ec2:<APPROVED_REGION>:<SANDBOX_ACCOUNT_ID>:instance/*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "<APPROVED_REGION>"
        },
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

Do not grant:

- `ec2:StartInstances`
- `ec2:StopInstances`
- `ec2:RebootInstances`
- `ec2:TerminateInstances`
- Security-group mutation actions
- IAM actions
- S3 actions
- VPC mutation actions
- Volume deletion actions
- Arbitrary CLI access
- Terraform apply permissions

Stop governed execution if:

- The target is not an EC2 instance from CloudShield `AWS_SYNC` inventory.
- The target account is production.
- The target region is not allowlisted.
- Tag keys are outside the CloudShield allowlist.
- The policy grants broader mutation permissions than `ec2:CreateTags` and `ec2:DeleteTags` on approved EC2 instance resources.
