import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const updateExportRegistryRoute: RouteDefinition = {
  operationId: "updateExportRegistry",
  method: "PUT",
  path: "/api/export/registries/{taskCode}",
  handler: createNotImplementedHandler("updateExportRegistry")
};
