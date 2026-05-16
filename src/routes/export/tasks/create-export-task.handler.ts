import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { createExportTask } from "../../../task-api/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = await requireAuthContext(context.request, "CREATE");
    const result = await createExportTask(auth, context.request.body ?? {});
    sendSuccess(response, result.statusCode, result.data);
  } catch (error) {
    await sendError(response, error);
  }
};
