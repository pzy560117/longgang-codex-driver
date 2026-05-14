import type { FastifyReply } from "fastify";

export type RouteContext = {
  params: Record<string, string>;
};

export type RouteHandler = (
  context: RouteContext,
  response: FastifyReply
) => Promise<void> | void;

export function sendJson(
  response: FastifyReply,
  statusCode: number,
  payload: unknown
): void {
  response.code(statusCode).type("application/json; charset=utf-8").send(payload);
}
