# Resource Normalization

Current AWS inventory normalization covers:

- `EC2_INSTANCE`
- `VPC`
- `SUBNET`
- `SECURITY_GROUP`
- `EBS_VOLUME`

Each AWS-synced resource stores:

- organization ID
- AWS account registry ID
- region
- normalized resource type
- external resource ID
- optional ARN when safely available
- display name
- state/status
- `source = AWS_SYNC`
- first seen, last seen, last verified, stale, and archived fields
- scan run reference
- normalized tags
- safe allowlisted metadata only

Raw AWS responses are not stored. Metadata is reduced to fields CloudShield needs for inventory, topology, posture, and evidence.
