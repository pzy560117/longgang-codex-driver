import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const disableExportRegistryRoute: RouteDefinition = {
  operationId: "disableExportRegistry",
  method: "POST",
  path: "/api/export/registries/{taskCode}/disable",
  handler: createNotImplementedHandler("disableExportRegistry")
};
