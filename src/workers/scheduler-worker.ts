import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/env.ts";
import { createDatabase } from "../db/index.ts";
import { createSchedulerWorker } from "../scheduler/worker.ts";

export type SchedulerWorkerRuntime = {
  pollIntervalMs: number;
  leaseModel: "lockOwner+lockExpireAt+leaseRenewedAt";
};

export function createSchedulerWorkerRuntime(): SchedulerWorkerRuntime {
  const config = loadConfig();
  return {
    pollIntervalMs: config.schedulerPollIntervalMs,
    leaseModel: "lockOwner+lockExpireAt+leaseRenewedAt"
  };
}

export function startSchedulerWorker(): NodeJS.Timeout {
  const config = loadConfig();
  const runtime = createSchedulerWorkerRuntime();
  const db = createDatabase();
  const worker = createSchedulerWorker({
    db,
    workerId: config.worker.schedulerWorkerId,
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1
  });
  let polling = false;

  console.log(
    JSON.stringify({
      event: "export-platform.scheduler.started",
      pollIntervalMs: runtime.pollIntervalMs,
      leaseModel: runtime.leaseModel
    })
  );
  return setInterval(() => {
    if (polling) {
      return;
    }
    polling = true;
    worker
      .pollAndProcessOnce()
      .then((result) => {
        console.log(
          JSON.stringify({
            event: "export-platform.scheduler.poll",
            ...result
          })
        );
      })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            event: "export-platform.scheduler.error",
            error: error instanceof Error ? error.message : String(error)
          })
        );
      })
      .finally(() => {
        polling = false;
      });
  }, runtime.pollIntervalMs);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startSchedulerWorker();
}
