import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { downloadExportTask } from "../../../task-api/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const auth = requireAuthContext(context.request);
    const query = context.request.query as Record<string, unknown>;
    const data = await downloadExportTask(
      auth,
      context.params.taskId,
      typeof query.mode === "string" ? query.mode : undefined
    );

    if (data.deliveryMode === "STREAM") {
      response
        .code(200)
        .type("application/octet-stream")
        .header("content-disposition", `attachment; filename="${data.fileName.replace(/"/g, '\\"')}"`)
        .header("x-export-file-name", data.fileName)
        .header("x-export-file-size", String(data.fileSize))
        .header("x-export-checksum", data.checksum)
        .header("x-export-checksum-algorithm", data.checksumAlgorithm)
        .header("x-export-attempt-no", String(data.attemptNo))
        .send(data.body);
      return;
    }

    sendSuccess(response, 200, data);
  } catch (error) {
    sendError(response, error);
  }
};
