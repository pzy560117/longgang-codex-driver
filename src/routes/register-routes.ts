import type { FastifyInstance, FastifyReply } from "fastify";
import { sendJson } from "../http/types.ts";
import { OPENAPI_OPERATION_ROUTES, type OperationRoute } from "./route-manifest.ts";

type RouteMatch = {
  route: OperationRoute;
  params: Record<string, string>;
};

function matchPath(pattern: string, actualPath: string): Record<string, string> | undefined {
  const patternSegments = pattern.split("/").filter(Boolean);
  const actualSegments = actualPath.split("/").filter(Boolean);

  if (patternSegments.length !== actualSegments.length) {
    return undefined;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const actualSegment = actualSegments[index];
    const paramMatch = patternSegment.match(/^\{([^}]+)\}$/);

    if (paramMatch) {
      params[paramMatch[1]] = decodeURIComponent(actualSegment);
      continue;
    }

    if (patternSegment !== actualSegment) {
      return undefined;
    }
  }

  return params;
}

function findRoute(method: string, pathname: string): RouteMatch | undefined {
  for (const route of OPENAPI_OPERATION_ROUTES) {
    if (route.method !== method) {
      continue;
    }

    const params = matchPath(route.path, pathname);
    if (params) {
      return { route, params };
    }
  }

  return undefined;
}

export async function handleApiRoute(
  method: string,
  pathname: string,
  response: FastifyReply
): Promise<boolean> {
  const routeMatch = findRoute(method, pathname);

  if (!routeMatch) {
    return false;
  }

  routeMatch.route.handler(
    { params: routeMatch.params, request: response.request },
    response
  );
  return true;
}

export function sendNotFound(response: FastifyReply): void {
  sendJson(response, 404, {
    code: "TASK_NOT_FOUND",
    message: "route not found",
    data: null
  });
}

export function registerRoutes(app: FastifyInstance): void {
  for (const route of OPENAPI_OPERATION_ROUTES) {
    const fastifyPath = route.path.replace(/\{([^}]+)\}/g, ":$1");
    app.route({
      method: route.method,
      url: fastifyPath,
      handler: async (request, response) => {
        await route.handler({ params: request.params as Record<string, string>, request }, response);
      }
    });
  }
}
