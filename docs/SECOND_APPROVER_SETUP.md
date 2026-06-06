# Second Approver Setup

CloudShield blocks self-approval for governed AWS changes. The preparer and approver must be different active users in the same organization.

Authoritative role source:

- `OrganizationMembership.role` is used by `requireAuth`.
- `User.role` must not be relied on to bypass membership permissions.
- Removed or inactive membership loses access.

Roles that can approve governed AWS changes:

- `OWNER`
- `ADMIN`
- `SECURITY_OPERATOR`

Roles that can prepare governed AWS changes:

- `OWNER`
- `ADMIN`
- `CLOUD_OPERATOR`

Relevant permissions:

- Prepare/simulate/request execution: `operations.prepare`
- Approve/reject: `approvals.decide`
- View evidence: `operations.read`
- View approvals: `approvals.read`
- View audit: `audit.read`

Setup steps:

1. Invite or create a second real CloudShield user.
2. Ensure the second user has an active `OrganizationMembership`.
3. Assign `OWNER`, `ADMIN`, or `SECURITY_OPERATOR` to the second user if they must approve.
4. Ensure the preparer uses a different account from the approver.
5. Confirm both users can sign in and their sessions reflect the membership role.
6. Confirm the approver can view `/api/v1/governance/approvals`.
7. Confirm the preparer cannot approve their own governed change.

Do not:

- Temporarily change the preparer's role to bypass self-approval.
- Share accounts.
- Approve from a removed or disabled membership.
- Use sample users as evidence for a real AWS validation milestone.

Stop conditions:

- No second eligible approver exists.
- The second user is not active in the same organization.
- The second user lacks `approvals.decide`.
- The preparer and approver are the same user.
- Cross-tenant approval is attempted.
