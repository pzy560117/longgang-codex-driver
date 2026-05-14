import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { listExportTasks } from "../../../task-api/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = requireAuthContext(context.request);
    const data = await listExportTasks(auth, context.request.query as Record<string, unknown>);
    sendSuccess(response, 200, data);
  } catch (error) {
    sendError(response, error);
  }
};
