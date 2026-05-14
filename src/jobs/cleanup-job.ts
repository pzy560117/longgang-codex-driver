import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/env.ts";

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
  const runtime = createCleanupJobRuntime();
  console.log(
    JSON.stringify({
      event: "export-platform.cleanup.started",
      pollIntervalMs: runtime.pollIntervalMs,
      cleanupOrder: runtime.cleanupOrder
    })
  );
  return setInterval(() => undefined, runtime.pollIntervalMs);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startCleanupJob();
}
