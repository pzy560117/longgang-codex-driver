import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/env.ts";

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
  const runtime = createSchedulerWorkerRuntime();
  console.log(
    JSON.stringify({
      event: "export-platform.scheduler.started",
      pollIntervalMs: runtime.pollIntervalMs,
      leaseModel: runtime.leaseModel
    })
  );
  return setInterval(() => undefined, runtime.pollIntervalMs);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startSchedulerWorker();
}
