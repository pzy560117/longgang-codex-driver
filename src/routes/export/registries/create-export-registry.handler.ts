import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { upsertExportRegistry } from "../../../registry-config/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = await requireAuthContext(context.request, "REGISTRY_CREATE");
    const data = await upsertExportRegistry(auth, context.request.body ?? {});
    sendSuccess(response, 201, data);
  } catch (error) {
    await sendError(response, error);
  }
};
