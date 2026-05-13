import type { AuditAction, AuditEvent, AuthContext } from "../shared/types.js";

export class AuditLogService {
  private readonly events: AuditEvent[] = [];

  record(
    context: AuthContext,
    action: AuditAction,
    detail: {
      taskId?: string;
      taskCode?: string;
      attemptNo?: number;
      detail?: Record<string, unknown>;
    } = {}
  ): AuditEvent {
    const event: AuditEvent = {
      action,
      taskId: detail.taskId,
      taskCode: detail.taskCode,
      attemptNo: detail.attemptNo,
      requestId: context.requestId,
      operatorId: context.operatorId,
      tenantId: context.tenantId,
      occurredAt: new Date().toISOString(),
      detail: detail.detail
    };
    this.events.push(event);
    return event;
  }

  listAuditEvents(filter: { taskId?: string; taskCode?: string } = {}): AuditEvent[] {
    return this.events.filter((event) => {
      if (filter.taskId && event.taskId !== filter.taskId) {
        return false;
      }
      if (filter.taskCode && event.taskCode !== filter.taskCode) {
        return false;
      }
      return true;
    });
  }
}
