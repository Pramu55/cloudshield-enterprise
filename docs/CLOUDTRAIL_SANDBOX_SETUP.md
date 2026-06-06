# CloudTrail Sandbox Setup

CloudTrail evidence is required before CloudShield governed tagging can be considered validated. The current code reports CloudTrail readiness as required and stores safe request IDs and CloudTrail correlation metadata in governed execution evidence, but it does not currently manage CloudTrail configuration itself.

Required setup in the sandbox account:

1. Enable CloudTrail for the dedicated non-production sandbox account.
2. Include management events.
3. Ensure EC2 `CreateTags` and `DeleteTags` API events are captured.
4. Ensure STS `AssumeRole` and `GetCallerIdentity` events are available for review.
5. Store CloudTrail logs in a controlled location outside this repository.
6. Restrict CloudTrail log access to approved operators.
7. Record only sanitized evidence in CloudShield or docs:
   - AWS request ID
   - Event name
   - Event time
   - Sandbox account ID
   - Approved region
   - Masked principal ARN

Do not commit:

- Raw CloudTrail files
- Session credential fields
- Full session context if it includes sensitive principal/session attributes
- External ID values
- Access keys or tokens

Validation stop conditions:

- CloudTrail is not enabled.
- CloudTrail cannot show `AssumeRole`, `GetCallerIdentity`, `CreateTags`, or rollback events.
- The CloudTrail event account ID or region does not match the configured sandbox.
- CloudTrail evidence reveals secrets.

Safe evidence format:

```text
CloudTrail enabled: yes
Account class: non-production sandbox
Approved region: <APPROVED_REGION>
Observed event names: AssumeRole, GetCallerIdentity, CreateTags
Request ID: <AWS_REQUEST_ID>
Principal ARN: arn:aws:sts::<SANDBOX_ACCOUNT_ID>:assumed-role/<ROLE_NAME>/***
Secrets exposed: no
```
