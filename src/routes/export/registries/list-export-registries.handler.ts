import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { listExportRegistries } from "../../../registry-config/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = await requireAuthContext(context.request, "REGISTRY_QUERY");
    const data = await listExportRegistries(
      auth,
      context.request.query as Record<string, unknown>
    );
    sendSuccess(response, 200, data);
  } catch (error) {
    await sendError(response, error);
  }
};
