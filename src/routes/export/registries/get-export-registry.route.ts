import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const getExportRegistryRoute: RouteDefinition = {
  operationId: "getExportRegistry",
  method: "GET",
  path: "/api/export/registries/{taskCode}",
  handler: createNotImplementedHandler("getExportRegistry")
};
