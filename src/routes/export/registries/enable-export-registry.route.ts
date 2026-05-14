import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const enableExportRegistryRoute: RouteDefinition = {
  operationId: "enableExportRegistry",
  method: "POST",
  path: "/api/export/registries/{taskCode}/enable",
  handler: createNotImplementedHandler("enableExportRegistry")
};
