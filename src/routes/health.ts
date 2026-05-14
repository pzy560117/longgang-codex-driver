import type { RouteDefinition } from "./types.ts";
import { sendJson } from "./http.ts";

export const healthRoute: RouteDefinition = {
  operationId: "healthCheck",
  method: "GET",
  path: "/health",
  handler: (_context, response) => {
    sendJson(response, 200, {
      status: "ok",
      service: "export-platform",
      deliveryShape: "independent_microservice",
      entries: {
        http: true,
        worker: true,
        cleanupJob: true
      }
    });
  }
};
