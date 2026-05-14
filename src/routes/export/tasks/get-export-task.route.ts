import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const getExportTaskRoute: RouteDefinition = {
  operationId: "getExportTask",
  method: "GET",
  path: "/api/export/tasks/{taskId}",
  handler: createNotImplementedHandler("getExportTask")
};
