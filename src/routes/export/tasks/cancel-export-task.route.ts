import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const cancelExportTaskRoute: RouteDefinition = {
  operationId: "cancelExportTask",
  method: "POST",
  path: "/api/export/tasks/{taskId}/cancel",
  handler: createNotImplementedHandler("cancelExportTask")
};
