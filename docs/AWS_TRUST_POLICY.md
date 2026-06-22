# AWS Scanner Trust Policy

Use a dedicated External ID to prevent confused-deputy access when the CloudShield runtime assumes a customer scanner role.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudShieldScanner",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::<CLOUDSHIELD_RUNTIME_ACCOUNT_ID>:role/CloudShieldRuntime"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "<CLOUDSHIELD_EXTERNAL_ID>"
        },
        "StringLike": {
          "sts:RoleSessionName": "cloudshield-*"
        }
      }
    }
  ]
}
```

The runtime principal must be a specific trusted IAM principal, never `*`. The External ID must be high-entropy, unique per customer account, and never reused across accounts.

Do not paste External IDs into public chats, screenshots, logs, tickets, source control, or CloudShield API responses. Store them in a secure runtime secret manager. Rotate an External ID by updating the AWS trust policy and secure runtime together during a controlled maintenance window, then repeat explicit STS validation.

This policy contains no credentials and grants only role assumption. Permissions come from the separate scanner permission policy.
