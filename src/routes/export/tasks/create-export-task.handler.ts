import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { createExportTask } from "../../../task-api/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = requireAuthContext(context.request);
    const result = await createExportTask(auth, context.request.body ?? {});
    sendSuccess(response, result.statusCode, result.data);
  } catch (error) {
    sendError(response, error);
  }
};
