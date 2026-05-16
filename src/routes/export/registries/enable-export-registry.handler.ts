import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { setExportRegistryEnabled } from "../../../registry-config/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = await requireAuthContext(context.request, "REGISTRY_ENABLE");
    const data = await setExportRegistryEnabled(auth, context.params.taskCode, true);
    sendSuccess(response, 200, data);
  } catch (error) {
    await sendError(response, error);
  }
};
