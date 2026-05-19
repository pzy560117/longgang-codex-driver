import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/env.ts";
import { createDatabase } from "../db/index.ts";
import { createCleanupJob } from "../cleanup-job/index.ts";

export type CleanupJobRuntime = {
  pollIntervalMs: number;
  cleanupOrder: "mark-expired-before-object-delete";
};

export function createCleanupJobRuntime(): CleanupJobRuntime {
  const config = loadConfig();
  return {
    pollIntervalMs: config.cleanupPollIntervalMs,
    cleanupOrder: "mark-expired-before-object-delete"
  };
}

export function startCleanupJob(): NodeJS.Timeout {
  const config = loadConfig();
  const runtime = createCleanupJobRuntime();
  const db = createDatabase();
  const job = createCleanupJob({
    db,
    workerId: config.worker.cleanupWorkerId
  });
  let polling = false;

  console.log(
    JSON.stringify({
      event: "export-platform.cleanup.started",
      pollIntervalMs: runtime.pollIntervalMs,
      cleanupOrder: runtime.cleanupOrder
    })
  );

  const poll = () => {
    if (polling) {
      return;
    }

    polling = true;
    job
      .pollOnce()
      .then((result) => {
        console.log(
          JSON.stringify({
            event: "export-platform.cleanup.poll",
            ...result
          })
        );
      })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            event: "export-platform.cleanup.error",
            error: error instanceof Error ? error.message : String(error)
          })
        );
      })
      .finally(() => {
        polling = false;
      });
  };

  poll();
  return setInterval(poll, runtime.pollIntervalMs);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startCleanupJob();
}
