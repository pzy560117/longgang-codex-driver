import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const retryExportTaskRoute: RouteDefinition = {
  operationId: "retryExportTask",
  method: "POST",
  path: "/api/export/tasks/{taskId}/retry",
  handler: createNotImplementedHandler("retryExportTask")
};
