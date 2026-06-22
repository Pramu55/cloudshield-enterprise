# Known Limitations

- No real AWS account validation has been performed.
- Inventory is limited to EC2 instances, VPCs, subnets, security groups, and EBS volumes.
- Production AWS accounts are blocked.
- Automatic remediation is disabled.
- Multi-service AWS inventory is not implemented.
- Per-account secret-manager integration is not implemented; v0.5.0 supports one securely configured scanner role for an approved sandbox runtime.
- Enterprise SSO and production deployment automation remain future work.
- No formal security or compliance audit has been completed.
- Disaster recovery has not been proven through a production exercise.
- No availability or response-time SLA is offered.
- No production deployment proof exists.
