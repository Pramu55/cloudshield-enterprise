import { Queue } from "bullmq";
import {
  GOVERNED_AWS_CHANGE_QUEUE_NAME,
  type GovernedAwsChangeJob
} from "@cloudshield/contracts";
import { createQueueConnection } from "../queue/queue-connection.js";

const connection = createQueueConnection();

export const governedAwsChangeQueue = process.env.DISABLE_QUEUE_CONNECTIONS_FOR_TESTS === "true"
  ? ({ name: GOVERNED_AWS_CHANGE_QUEUE_NAME, add: async () => {}, close: async () => {} } as unknown as Queue<GovernedAwsChangeJob>)
  : new Queue<GovernedAwsChangeJob>(
      GOVERNED_AWS_CHANGE_QUEUE_NAME,
      { connection }
    );
