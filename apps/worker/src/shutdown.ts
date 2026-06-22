export type CloseResource = {
  name: string;
  close: () => Promise<unknown> | unknown;
};

export type WorkerShutdownDependencies = {
  stopTimers: () => void;
  workers: CloseResource[];
  queues: CloseResource[];
  disconnectPrisma: () => Promise<unknown> | unknown;
  timeoutMs?: number;
};

export type WorkerShutdownResult = {
  ok: boolean;
  timedOut: boolean;
  closedWorkers: string[];
  closedQueues: string[];
  prismaDisconnected: boolean;
  closeFailures: string[];
};

type ShutdownProgress = {
  closedWorkers: string[];
  closedQueues: string[];
  prismaDisconnected: boolean;
  closeFailures: string[];
};

export async function shutdownWorkerRuntime(
  dependencies: WorkerShutdownDependencies
): Promise<WorkerShutdownResult> {
  const progress: ShutdownProgress = {
    closedWorkers: [],
    closedQueues: [],
    prismaDisconnected: false,
    closeFailures: []
  };

  const snapshot = (timedOut: boolean): WorkerShutdownResult => ({
    ok: !timedOut && progress.closeFailures.length === 0,
    timedOut,
    closedWorkers: [...progress.closedWorkers],
    closedQueues: [...progress.closedQueues],
    prismaDisconnected: progress.prismaDisconnected,
    closeFailures: [...progress.closeFailures]
  });

  async function closeResource(
    resource: CloseResource,
    closed: string[]
  ) {
    try {
      await resource.close();
      closed.push(resource.name);
    } catch {
      progress.closeFailures.push(resource.name);
    }
  }

  return new Promise<WorkerShutdownResult>((resolve) => {
    let settled = false;
    const finish = (result: WorkerShutdownResult, timer: ReturnType<typeof setTimeout>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timeoutMs = Math.max(1, dependencies.timeoutMs ?? 30_000);
    const timer = setTimeout(() => {
      finish(snapshot(true), timer);
    }, timeoutMs);
    if (typeof timer === "object" && "unref" in timer && typeof timer.unref === "function") {
      timer.unref();
    }

    const closeSequence = async () => {
      try {
        dependencies.stopTimers();
      } catch {
        progress.closeFailures.push("timers");
      }

      for (const worker of dependencies.workers) {
        await closeResource(worker, progress.closedWorkers);
      }

      for (const queue of dependencies.queues) {
        await closeResource(queue, progress.closedQueues);
      }

      try {
        await dependencies.disconnectPrisma();
        progress.prismaDisconnected = true;
      } catch {
        progress.closeFailures.push("prisma");
      }

      finish(snapshot(false), timer);
    };

    void closeSequence();
  });
}

export function createSingleRunShutdown(
  dependencies: WorkerShutdownDependencies
) {
  let current: Promise<WorkerShutdownResult> | null = null;

  return () => {
    if (!current) {
      current = shutdownWorkerRuntime(dependencies);
    }
    return current;
  };
}
