import { handler as createExportRegistry } from "./export/registries/create-export-registry.handler.ts";
import { handler as disableExportRegistry } from "./export/registries/disable-export-registry.handler.ts";
import { handler as enableExportRegistry } from "./export/registries/enable-export-registry.handler.ts";
import { handler as getExportRegistry } from "./export/registries/get-export-registry.handler.ts";
import { handler as listExportRegistries } from "./export/registries/list-export-registries.handler.ts";
import { handler as updateExportRegistry } from "./export/registries/update-export-registry.handler.ts";
import { handler as cancelExportTask } from "./export/tasks/cancel-export-task.handler.ts";
import { handler as createExportTask } from "./export/tasks/create-export-task.handler.ts";
import { handler as downloadExportTask } from "./export/tasks/download-export-task.handler.ts";
import { handler as getExportTask } from "./export/tasks/get-export-task.handler.ts";
import { handler as listExportTasks } from "./export/tasks/list-export-tasks.handler.ts";
import { handler as retryExportTask } from "./export/tasks/retry-export-task.handler.ts";
import type { RouteHandler } from "./types.ts";

export type OperationRoute = {
  operationId: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  handlerPath: string;
  handler: RouteHandler;
  tests: string[];
};

const scaffoldContractTest = "tests/contract/openapi-route-mapping.contract.test.mjs";

export const OPENAPI_OPERATION_ROUTES: OperationRoute[] = [
  {
    operationId: "createExportTask",
    method: "POST",
    path: "/api/export/tasks",
    handlerPath: "src/routes/export/tasks/create-export-task.handler.ts",
    handler: createExportTask,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "listExportTasks",
    method: "GET",
    path: "/api/export/tasks",
    handlerPath: "src/routes/export/tasks/list-export-tasks.handler.ts",
    handler: listExportTasks,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "getExportTask",
    method: "GET",
    path: "/api/export/tasks/{taskId}",
    handlerPath: "src/routes/export/tasks/get-export-task.handler.ts",
    handler: getExportTask,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "downloadExportTask",
    method: "GET",
    path: "/api/export/tasks/{taskId}/download",
    handlerPath: "src/routes/export/tasks/download-export-task.handler.ts",
    handler: downloadExportTask,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "cancelExportTask",
    method: "POST",
    path: "/api/export/tasks/{taskId}/cancel",
    handlerPath: "src/routes/export/tasks/cancel-export-task.handler.ts",
    handler: cancelExportTask,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "retryExportTask",
    method: "POST",
    path: "/api/export/tasks/{taskId}/retry",
    handlerPath: "src/routes/export/tasks/retry-export-task.handler.ts",
    handler: retryExportTask,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "createExportRegistry",
    method: "POST",
    path: "/api/export/registries",
    handlerPath: "src/routes/export/registries/create-export-registry.handler.ts",
    handler: createExportRegistry,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "listExportRegistries",
    method: "GET",
    path: "/api/export/registries",
    handlerPath: "src/routes/export/registries/list-export-registries.handler.ts",
    handler: listExportRegistries,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "getExportRegistry",
    method: "GET",
    path: "/api/export/registries/{taskCode}",
    handlerPath: "src/routes/export/registries/get-export-registry.handler.ts",
    handler: getExportRegistry,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "updateExportRegistry",
    method: "PUT",
    path: "/api/export/registries/{taskCode}",
    handlerPath: "src/routes/export/registries/update-export-registry.handler.ts",
    handler: updateExportRegistry,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "enableExportRegistry",
    method: "POST",
    path: "/api/export/registries/{taskCode}/enable",
    handlerPath: "src/routes/export/registries/enable-export-registry.handler.ts",
    handler: enableExportRegistry,
    tests: [scaffoldContractTest]
  },
  {
    operationId: "disableExportRegistry",
    method: "POST",
    path: "/api/export/registries/{taskCode}/disable",
    handlerPath: "src/routes/export/registries/disable-export-registry.handler.ts",
    handler: disableExportRegistry,
    tests: [scaffoldContractTest]
  }
];
