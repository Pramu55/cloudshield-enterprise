# AWS IAM Design

CloudShield v0.5.0 uses a scanner role for explicitly approved, non-production, read-only AWS inventory. Real AWS validation is a separate operator checkpoint and has not been performed for this release candidate.

## Scanner Permission Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudShieldReadOnlyInventory",
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity",
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

Many AWS Describe operations do not support resource-level IAM restrictions, so `Resource: "*"` is required. Safety comes from the read-only action allowlist, account and region allowlists, role trust policy, External ID, non-production restriction, and disabled-by-default runtime gates.

The scanner policy contains no IAM writes, EC2 writes, S3 writes, resource creation, deletion, tagging, network-rule changes, or remediation actions. CloudShield does not require or store long-lived AWS access keys.

## Separate Executor Design

A future executor role must remain separate from the scanner role. It requires separate authorization, trust, External ID, approval, evidence, and rollout review. It is not enabled by this release.

## Sandbox Setup

1. Create a dedicated non-production sandbox account.
2. Create the scanner role using the read-only policy above.
3. Apply the trust policy from `AWS_TRUST_POLICY.md`.
4. Configure `<CUSTOMER_ACCOUNT_ID>`, role ARN, `<CLOUDSHIELD_EXTERNAL_ID>`, and `<REGION>` only in the secure runtime.
5. Add the account metadata in CloudShield.
6. Verify onboarding preflight.
7. Obtain explicit authorization before STS validation.
8. Validate identity before requesting inventory sync.

Production accounts remain blocked in v0.5.0.
