import type { FastifyReply } from "fastify";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RouteParams {
  [key: string]: string;
}

export interface RouteContext {
  params: RouteParams;
}

export interface RouteHandler {
  (context: RouteContext, response: FastifyReply): Promise<void> | void;
}

export interface RouteDefinition {
  operationId: string;
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
}
