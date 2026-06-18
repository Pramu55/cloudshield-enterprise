import test from "node:test";
import assert from "node:assert/strict";
import {
  createSingleRunShutdown,
  shutdownWorkerRuntime,
  type CloseResource
} from "../shutdown.js";

function closable(name: string, calls: string[]): CloseResource {
  return {
    name,
    close: async () => {
      calls.push(name);
    }
  };
}

test("worker shutdown closes timers, workers, queues, and Prisma in order", async () => {
  const calls: string[] = [];
  const result = await shutdownWorkerRuntime({
    stopTimers: () => calls.push("timers"),
    workers: [closable("worker-a", calls), closable("worker-b", calls)],
    queues: [closable("queue-a", calls)],
    disconnectPrisma: async () => calls.push("prisma"),
    timeoutMs: 1_000
  });

  assert.equal(result.ok, true);
  assert.equal(result.timedOut, false);
  assert.deepEqual(calls, ["timers", "worker-a", "worker-b", "queue-a", "prisma"]);
  assert.deepEqual(result.closedWorkers, ["worker-a", "worker-b"]);
  assert.deepEqual(result.closedQueues, ["queue-a"]);
  assert.equal(result.prismaDisconnected, true);
  assert.deepEqual(result.closeFailures, []);
});

test("worker shutdown executes once for repeated signal handlers", async () => {
  const calls: string[] = [];
  const shutdown = createSingleRunShutdown({
    stopTimers: () => calls.push("timers"),
    workers: [closable("worker-a", calls)],
    queues: [closable("queue-a", calls)],
    disconnectPrisma: async () => calls.push("prisma"),
    timeoutMs: 1_000
  });

  const [first, second] = await Promise.all([shutdown(), shutdown()]);

  assert.equal(first, second);
  assert.deepEqual(calls, ["timers", "worker-a", "queue-a", "prisma"]);
});

test("worker shutdown reports timeout progress without claiming success", async () => {
  const calls: string[] = [];
  let releaseBlockedClose: () => void = () => {};
  let releaseBlockedCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let markCloseSequenceComplete: () => void = () => {};

  const blockedClose = new Promise<void>((resolve) => {
    releaseBlockedClose = resolve;
  });

  const closeSequenceComplete = new Promise<void>((resolve) => {
    markCloseSequenceComplete = resolve;
  });

  try {
    releaseBlockedCloseTimer = setTimeout(releaseBlockedClose, 25);

    const result = await shutdownWorkerRuntime({
      stopTimers: () => calls.push("timers"),
      workers: [{
        name: "closed-worker",
        close: async () => {
          calls.push("closed-worker");
        }
      }, {
        name: "blocked-worker",
        close: () => blockedClose
      }],
      queues: [],
      disconnectPrisma: async () => {
        markCloseSequenceComplete();
      },
      timeoutMs: 5
    });

    assert.equal(result.ok, false);
    assert.equal(result.timedOut, true);
    assert.deepEqual(result.closedWorkers, ["closed-worker"]);
    assert.equal(result.prismaDisconnected, false);
  } finally {
    if (releaseBlockedCloseTimer) clearTimeout(releaseBlockedCloseTimer);
    releaseBlockedClose();
    await closeSequenceComplete;
  }
});

test("worker shutdown cleans up partially initialized runtime", async () => {
  const calls: string[] = [];
  const result = await shutdownWorkerRuntime({
    stopTimers: () => calls.push("timers"),
    workers: [],
    queues: [closable("queue-a", calls)],
    disconnectPrisma: async () => calls.push("prisma"),
    timeoutMs: 1_000
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["timers", "queue-a", "prisma"]);
});

test("worker shutdown resource list closes every worker queue exactly once", async () => {
  const closed: string[] = [];
  const queueNames = [
    "cloud-scans",
    "cloud-inventory-sync",
    "cloud-assessment",
    "governed-aws-changes",
    "security-monitoring"
  ];
  const result = await shutdownWorkerRuntime({
    stopTimers: () => {},
    workers: [],
    queues: queueNames.map((name) => closable(name, closed)),
    disconnectPrisma: async () => {},
    timeoutMs: 1_000
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.closedQueues, queueNames);
  for (const queueName of queueNames) {
    assert.equal(closed.filter((name) => name === queueName).length, 1);
  }
});

test("worker shutdown consumes late close rejection after timeout", async () => {
  let rejectLate: () => void = () => {};
  const lateFailure = new Promise<void>((_resolve, reject) => {
    rejectLate = () => reject(new Error("synthetic late close failure"));
  });

  const result = await shutdownWorkerRuntime({
    stopTimers: () => {},
    workers: [{
      name: "late-worker",
      close: () => lateFailure
    }],
    queues: [],
    disconnectPrisma: async () => {},
    timeoutMs: 5
  });

  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
  rejectLate();
  await new Promise((resolve) => setTimeout(resolve, 10));
});
