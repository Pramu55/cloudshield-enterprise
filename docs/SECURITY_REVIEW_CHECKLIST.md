# Security Review Checklist

- Confirm `AWS_CHANGE_EXECUTION_MODE=disabled` by default.
- Confirm organization opt-in is false by default.
- Confirm account opt-in is false by default.
- Confirm sample/demo resources cannot execute.
- Confirm tenant-owned records are always scoped by `organizationId`.
- Confirm no controller executes AWS mutation APIs.
- Confirm worker queue is the only execution path.
- Confirm confirmation tokens are exact-match.
- Confirm high-risk self-approval is blocked.
- Confirm production mode is not enabled in this milestone.
- Confirm secrets and AWS credentials are not logged.
- Confirm raw AWS errors are not exposed to the frontend.
- Confirm rollback requires separate approval.
