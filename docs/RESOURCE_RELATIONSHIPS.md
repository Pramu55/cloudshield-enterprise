# Resource Relationships

Relationship records are tenant-scoped and idempotent.

Current relationships:

- EC2 instance to subnet
- EC2 instance to VPC
- EC2 instance to security group
- EBS volume to EC2 instance
- subnet to VPC
- security group to VPC

Relationships use a unique organization, source resource, target resource, and relationship type key. The worker verifies both endpoints belong to the same organization before writing an edge.

Relationship fields track:

- source classification
- first seen
- last seen
- stale timestamp
- last scan run
- safe evidence

No relationship may cross organizations.
