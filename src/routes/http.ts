import type { FastifyReply } from "fastify";
import type { RouteDefinition, RouteParams } from "./types.ts";

interface MatchedRoute {
  route: RouteDefinition;
  params: RouteParams;
}

function splitPath(value: string): string[] {
  return value.split("/").filter(Boolean);
}

export function matchRoute(
  routes: RouteDefinition[],
  method: string,
  pathname: string
): MatchedRoute | undefined {
  const normalizedMethod = method.toUpperCase();
  const pathSegments = splitPath(pathname);

  for (const route of routes) {
    if (route.method !== normalizedMethod) {
      continue;
    }

    const routeSegments = splitPath(route.path);
    if (routeSegments.length !== pathSegments.length) {
      continue;
    }

    const params: RouteParams = {};
    let matched = true;

    for (let index = 0; index < routeSegments.length; index += 1) {
      const routeSegment = routeSegments[index];
      const pathSegment = pathSegments[index];

      if (!routeSegment || !pathSegment) {
        matched = false;
        break;
      }

      if (routeSegment.startsWith("{") && routeSegment.endsWith("}")) {
        params[routeSegment.slice(1, -1)] = decodeURIComponent(pathSegment);
        continue;
      }

      if (routeSegment !== pathSegment) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { route, params };
    }
  }

  return undefined;
}

export function sendJson(
  response: FastifyReply,
  statusCode: number,
  payload: unknown
): void {
  response.code(statusCode).type("application/json; charset=utf-8").send(payload);
}

export function createNotImplementedHandler(operationId: string) {
  return (_context: unknown, response: FastifyReply) => {
    sendJson(response, 501, {
      code: "INTERNAL_ERROR",
      message: `${operationId} scaffolded but not implemented`,
      data: {
        operationId,
        boundary: "http_route"
      }
    });
  };
}
