# AWS Security Monitoring

This document describes the foundation for continuous security monitoring in CloudShield.

## Overview
Monitoring continuously evaluates AWS inventory, findings, scan runs, and compliance evidence against a set of deterministic rules to generate actionable alerts.

## Architecture
- **Trigger**: Backend explicit `POST /api/v1/security-monitoring/evaluate` request. No cron jobs or automatic timers.
- **Queueing**: BullMQ creates a job in `security-monitoring-queue`.
- **Worker Execution**: Worker node pulls the job.
- **Orchestration**: The `MonitoringOrchestrator` loads all necessary data from the tenant-scoped database.
- **Evaluation**: The pure `MonitoringEngine` in `@cloudshield/security-monitoring` evaluates the rules based on normalized input data.
- **Persistence**:
  - A deterministic `MonitoringSnapshot` is built by `MonitoringSnapshotBuilder` and persisted.
  - New `SecurityAlert` records are created and old ones are updated.
  - Notifications are created for `CRITICAL` or `HIGH` alerts, or specific degraded configurations.
  - Alerts missing from current evaluation are auto-resolved.

## Data Boundaries
- The `@cloudshield/security-monitoring` package is 100% pure domain logic and contains no side effects or API calls.
- The Worker handles database interactions and queue polling.
- The Backend handles explicit triggers and simple read paths.
