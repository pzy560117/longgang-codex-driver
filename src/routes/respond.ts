import type { FastifyReply } from "fastify";
import { ApiError } from "../audit-log/auth-context.ts";
import { sendJson } from "../http/types.ts";

export function sendSuccess(response: FastifyReply, statusCode: number, data: unknown): void {
  sendJson(response, statusCode, {
    code: "SUCCESS",
    message: "success",
    data
  });
}

export async function sendError(response: FastifyReply, error: unknown): Promise<void> {
  if (error instanceof ApiError) {
    sendJson(response, error.statusCode, {
      code: error.code,
      message: error.message,
      data: error.data
    });
    return;
  }

  sendJson(response, 500, {
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "internal error",
    data: null
  });
}
