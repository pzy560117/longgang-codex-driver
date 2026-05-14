import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const downloadExportTaskRoute: RouteDefinition = {
  operationId: "downloadExportTask",
  method: "GET",
  path: "/api/export/tasks/{taskId}/download",
  handler: createNotImplementedHandler("downloadExportTask")
};
