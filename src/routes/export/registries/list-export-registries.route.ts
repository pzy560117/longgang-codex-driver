import type { RouteDefinition } from "../../types.ts";
import { createNotImplementedHandler } from "../../http.ts";

export const listExportRegistriesRoute: RouteDefinition = {
  operationId: "listExportRegistries",
  method: "GET",
  path: "/api/export/registries",
  handler: createNotImplementedHandler("listExportRegistries")
};
