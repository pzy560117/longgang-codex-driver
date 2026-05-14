import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const listExportTasksRoute: RouteDefinition = {
  operationId: "listExportTasks",
  method: "GET",
  path: "/api/export/tasks",
  handler: createNotImplementedHandler("listExportTasks")
};
