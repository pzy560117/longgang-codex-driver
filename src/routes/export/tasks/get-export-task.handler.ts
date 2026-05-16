import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { getExportTask } from "../../../task-api/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = await requireAuthContext(context.request, "DETAIL_VIEW");
    const data = await getExportTask(auth, context.params.taskId);
    sendSuccess(response, 200, data);
  } catch (error) {
    await sendError(response, error);
  }
};
