import { Queue } from "bullmq";
import { CLOUD_ASSESSMENT_QUEUE_NAME } from "@cloudshield/contracts";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || "6379")
};

export const cloudAssessmentQueue = process.env.DISABLE_QUEUE_CONNECTIONS_FOR_TESTS === "true"
  ? ({ name: CLOUD_ASSESSMENT_QUEUE_NAME, add: async () => {}, close: async () => {} } as unknown as Queue)
  : new Queue(CLOUD_ASSESSMENT_QUEUE_NAME, {
      connection
    });
