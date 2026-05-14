import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";
import { createExportAuditRepository } from "../repositories/index.ts";
import type { AuthContext } from "./auth-context.ts";

export async function appendAudit(input: {
  db: Kysely<ExportPlatformDatabase>;
  auth: AuthContext;
  taskId: string | null;
  attemptNo: number | null;
  taskCode: string | null;
  subsystemCode: string | null;
  action: string;
  result?: string;
  errorCode?: string;
  now: Date;
}): Promise<void> {
  await createExportAuditRepository(input.db).appendAuditLog({
    auditId: `audit_${randomUUID()}`,
    taskId: input.taskId,
    attemptNo: input.attemptNo,
    taskCode: input.taskCode,
    subsystemCode: input.subsystemCode,
    operatorId: input.auth.operatorId,
    action: input.action,
    result: input.result ?? "SUCCESS",
    errorCode: input.errorCode ?? "SUCCESS",
    requestId: input.auth.requestId,
    occurredAt: input.now,
    now: input.now
  });
}
