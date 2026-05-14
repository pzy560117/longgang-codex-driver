import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const createExportRegistryRoute: RouteDefinition = {
  operationId: "createExportRegistry",
  method: "POST",
  path: "/api/export/registries",
  handler: createNotImplementedHandler("createExportRegistry")
};
