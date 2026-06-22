import { Queue } from "bullmq";
import { SECURITY_MONITORING_QUEUE_NAME } from "@cloudshield/contracts";
import { createQueueConnection } from "../queue/queue-connection.js";

const connection = createQueueConnection();

export const securityMonitoringQueue = process.env.DISABLE_QUEUE_CONNECTIONS_FOR_TESTS === "true"
  ? ({ name: SECURITY_MONITORING_QUEUE_NAME, add: async () => {}, close: async () => {} } as unknown as Queue)
  : new Queue(SECURITY_MONITORING_QUEUE_NAME, {
      connection,
    });
