import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { upsertExportRegistry } from "../../../registry-config/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = await requireAuthContext(context.request, "REGISTRY_UPDATE");
    const data = await upsertExportRegistry(
      auth,
      context.request.body ?? {},
      context.params.taskCode
    );
    sendSuccess(response, 200, data);
  } catch (error) {
    await sendError(response, error);
  }
};
