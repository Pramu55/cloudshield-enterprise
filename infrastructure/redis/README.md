# Redis Infrastructure

CloudShield uses Redis for BullMQ background jobs.

The foundation queue is `cloud-scans`. AWS scanner jobs are declared as contracts, but no scanner implementation or AWS credentials are included in this milestone.
