import type { RouteHandler } from "../http/types.ts";
import { sendJson } from "../http/types.ts";

export function createScaffoldHandler(operationId: string): RouteHandler {
  return (_context, response) => {
    sendScaffoldResponse(operationId, response);
  };
}

export function sendScaffoldResponse(operationId: string, response: Parameters<RouteHandler>[1]): void {
  sendJson(response, 501, {
    code: "INTERNAL_ERROR",
    message: "operation scaffolded; production implementation pending",
    data: {
      operationId
    }
  });
}
