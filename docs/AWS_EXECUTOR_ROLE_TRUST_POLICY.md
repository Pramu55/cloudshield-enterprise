# AWS Executor Role Trust Policy

Use this template for the executor role in the dedicated non-production sandbox account. The executor role is used only for the governed tagging stage and must use a different External ID from the scanner role.

Template:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudShieldExecutorAssumeRoleWithExternalId",
      "Effect": "Allow",
      "Principal": {
        "AWS": "<CLOUDSHIELD_PRINCIPAL_ARN>"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "<EXECUTOR_EXTERNAL_ID>"
        }
      }
    }
  ]
}
```

Requirements:

- `<CLOUDSHIELD_PRINCIPAL_ARN>` must be a specific trusted principal ARN. Do not use `*`.
- `<EXECUTOR_EXTERNAL_ID>` must be different from `<SCANNER_EXTERNAL_ID>`.
- Store the real executor External ID only in the secure runtime environment as `AWS_EXECUTOR_EXTERNAL_ID`.
- Do not reuse the scanner External ID.
- Stop governed execution if the principal is wildcarded or the External ID condition is missing.
