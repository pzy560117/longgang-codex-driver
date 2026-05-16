import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { cancelExportTask } from "../../../task-api/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = await requireAuthContext(context.request, "CANCEL_REQUEST");
    const data = await cancelExportTask(auth, context.params.taskId);
    sendSuccess(response, 200, data);
  } catch (error) {
    await sendError(response, error);
  }
};
