import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { listExportTasks } from "../../../task-api/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = await requireAuthContext(context.request, "QUERY_HISTORY");
    const data = await listExportTasks(auth, context.request.query as Record<string, unknown>);
    sendSuccess(response, 200, data);
  } catch (error) {
    await sendError(response, error);
  }
};
