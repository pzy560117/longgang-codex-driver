import { requireAuthContext } from "../../../audit-log/auth-context.ts";
import { downloadExportTask, downloadSignedExportTask } from "../../../task-api/service.ts";
import { sendError, sendSuccess } from "../../respond.ts";
import type { RouteHandler } from "../../types.ts";

export const handler: RouteHandler = async (context, response) => {
  try {
    const query = context.request.query as Record<string, unknown>;
    const hasSignedDownloadQuery =
      typeof query.signature === "string" ||
      typeof query.expiresAt === "string" ||
      typeof query.signatureAlgorithm === "string";
    const data = hasSignedDownloadQuery
      ? await downloadSignedExportTask(context.params.taskId, query)
      : await downloadExportTask(
          await requireAuthContext(context.request, "DOWNLOAD"),
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
    await sendError(response, error);
  }
};
