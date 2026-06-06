# AWS Scanner Role Trust Policy

Use this template for the scanner role in the dedicated non-production sandbox account. Replace placeholders only in AWS or a secure deployment system. Do not commit real External ID values.

The scanner role is used by CloudShield for:

- `sts:AssumeRole`
- `sts:GetCallerIdentity`
- EC2 read-only inventory through the worker

Template:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudShieldScannerAssumeRoleWithExternalId",
      "Effect": "Allow",
      "Principal": {
        "AWS": "<CLOUDSHIELD_PRINCIPAL_ARN>"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "<SCANNER_EXTERNAL_ID>"
        }
      }
    }
  ]
}
```

Requirements:

- `<CLOUDSHIELD_PRINCIPAL_ARN>` must be a specific trusted principal ARN. Do not use `*`.
- `<SCANNER_EXTERNAL_ID>` must be different from `<EXECUTOR_EXTERNAL_ID>`.
- Store the real scanner External ID only in the secure runtime environment as `AWS_EXTERNAL_ID`.
- The scanner trust policy must not trust the executor role unless that is the intended CloudShield principal.
- Stop validation if the principal is wildcarded or the External ID condition is missing.
