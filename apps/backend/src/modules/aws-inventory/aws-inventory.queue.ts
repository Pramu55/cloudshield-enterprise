import { Queue, type JobsOptions } from "bullmq";
import { CLOUD_INVENTORY_SYNC_QUEUE_NAME } from "@cloudshield/contracts";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || "6379"),
};

type InventoryQueueJob = { id?: string };
type InventoryQueueAdd = (
  name: string,
  data: Record<string, unknown>,
  opts?: JobsOptions
) => Promise<InventoryQueueJob>;

export let __testQueueAddMock: InventoryQueueAdd | null = null;
export function setTestQueueAddMock(mock: typeof __testQueueAddMock) {
  __testQueueAddMock = mock;
}

const productionQueue = process.env.DISABLE_QUEUE_CONNECTIONS_FOR_TESTS === "true"
  ? null
  : new Queue(CLOUD_INVENTORY_SYNC_QUEUE_NAME, { connection });

function getProductionQueue() {
  if (!productionQueue) {
    throw new Error("Inventory queue is unavailable.");
  }
  return productionQueue;
}

export const cloudScanQueue = process.env.DISABLE_QUEUE_CONNECTIONS_FOR_TESTS === "true"
  ? {
      name: CLOUD_INVENTORY_SYNC_QUEUE_NAME,
      add: async (name: string, data: Record<string, unknown>, opts?: JobsOptions) => {
        if (__testQueueAddMock) return __testQueueAddMock(name, data, opts);
        return { id: "test-stub-job-id" };
      },
      close: async () => {}
    }
  : {
      name: CLOUD_INVENTORY_SYNC_QUEUE_NAME,
      add: async (name: string, data: Record<string, unknown>, opts?: JobsOptions) => {
        const job = await getProductionQueue().add(name, data, opts);
        return { id: job.id };
      },
      close: async () => getProductionQueue().close()
    };
