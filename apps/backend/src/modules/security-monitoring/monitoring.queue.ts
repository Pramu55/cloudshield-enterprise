import { Queue } from "bullmq";
import { SECURITY_MONITORING_QUEUE_NAME } from "@cloudshield/contracts";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || "6379"),
};

export const securityMonitoringQueue = process.env.DISABLE_QUEUE_CONNECTIONS_FOR_TESTS === "true"
  ? ({ name: SECURITY_MONITORING_QUEUE_NAME, add: async () => {}, close: async () => {} } as unknown as Queue)
  : new Queue(SECURITY_MONITORING_QUEUE_NAME, {
      connection,
    });
