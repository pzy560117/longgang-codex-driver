import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const createExportTaskRoute: RouteDefinition = {
  operationId: "createExportTask",
  method: "POST",
  path: "/api/export/tasks",
  handler: createNotImplementedHandler("createExportTask")
};
