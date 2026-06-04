import { Queue } from "bullmq";
import { CLOUD_INVENTORY_SYNC_QUEUE_NAME } from "@cloudshield/contracts";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || "6379"),
};

export const cloudScanQueue = new Queue(CLOUD_INVENTORY_SYNC_QUEUE_NAME, {
  connection,
});
