import { Queue } from "bullmq";
import { GOVERNED_AWS_CHANGE_QUEUE_NAME } from "@cloudshield/contracts";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || "6379")
};

export type GovernedAwsChangeJob = {
  organizationId: string;
  planId: string;
  requestedById: string;
  idempotencyKey: string;
};

export const governedAwsChangeQueue = process.env.DISABLE_QUEUE_CONNECTIONS_FOR_TESTS === "true"
  ? ({ name: GOVERNED_AWS_CHANGE_QUEUE_NAME, add: async () => {}, close: async () => {} } as unknown as Queue<GovernedAwsChangeJob>)
  : new Queue<GovernedAwsChangeJob>(
      GOVERNED_AWS_CHANGE_QUEUE_NAME,
      { connection }
    );
