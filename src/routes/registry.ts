import { healthRoute } from "./health.ts";
import { createExportRegistryRoute } from "./export/registries/create-export-registry.route.ts";
import { disableExportRegistryRoute } from "./export/registries/disable-export-registry.route.ts";
import { enableExportRegistryRoute } from "./export/registries/enable-export-registry.route.ts";
import { getExportRegistryRoute } from "./export/registries/get-export-registry.route.ts";
import { listExportRegistriesRoute } from "./export/registries/list-export-registries.route.ts";
import { updateExportRegistryRoute } from "./export/registries/update-export-registry.route.ts";
import { cancelExportTaskRoute } from "./export/tasks/cancel-export-task.route.ts";
import { createExportTaskRoute } from "./export/tasks/create-export-task.route.ts";
import { downloadExportTaskRoute } from "./export/tasks/download-export-task.route.ts";
import { getExportTaskRoute } from "./export/tasks/get-export-task.route.ts";
import { listExportTasksRoute } from "./export/tasks/list-export-tasks.route.ts";
import { retryExportTaskRoute } from "./export/tasks/retry-export-task.route.ts";
import type { RouteDefinition } from "./types.ts";

export const routes: RouteDefinition[] = [
  healthRoute,
  createExportTaskRoute,
  listExportTasksRoute,
  getExportTaskRoute,
  downloadExportTaskRoute,
  cancelExportTaskRoute,
  retryExportTaskRoute,
  createExportRegistryRoute,
  listExportRegistriesRoute,
  getExportRegistryRoute,
  updateExportRegistryRoute,
  enableExportRegistryRoute,
  disableExportRegistryRoute
];
