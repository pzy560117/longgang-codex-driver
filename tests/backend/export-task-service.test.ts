import { beforeEach, describe, expect, it } from "vitest";

import { AuditLogService } from "../../src/audit-log/service.js";
import { ExportTaskService } from "../../src/task-api/service.js";
import { InMemoryExportTaskRepository } from "../../src/task-api/task-repository.js";
import { RegistryConfigService } from "../../src/registry-config/service.js";
import { InMemoryRegistryRepository } from "../../src/registry-config/registry-repository.js";
import type {
  AuthContext,
  CreateExportTaskRequest,
  ExportRegistryUpsertRequest
} from "../../src/shared/types.js";

const adminContext: AuthContext = {
  operatorId: "admin-001",
  tenantId: "tenant-001",
  roleCodes: ["EXPORT_ADMIN"],
  orgScope: ["ORG-001", "ORG-002"],
  requestId: "req-admin-001"
};

const operatorContext: AuthContext = {
  operatorId: "user-001",
  tenantId: "tenant-001",
  roleCodes: ["EXPORT_OPERATOR"],
  orgScope: ["ORG-001"],
  requestId: "req-user-001"
};

const otherOperatorContext: AuthContext = {
  operatorId: "user-002",
  tenantId: "tenant-001",
  roleCodes: ["EXPORT_OPERATOR"],
  orgScope: ["ORG-002"],
  requestId: "req-user-002"
};

const baseRegistry: ExportRegistryUpsertRequest = {
  taskCode: "purchase-order-export",
  subsystemCode: "purchase",
  displayName: "Purchase order export",
  enabled: true,
  concurrencyLimit: 3,
  fileRetentionDays: 15,
  taskHistoryRetentionDays: 30,
  singleFileMaxRows: 20000,
  exportMaxRows: 100000,
  supportedFormats: ["XLSX", "ZIP"],
  datasourceCode: "purchase_ro",
  parameterSchema: {
    required: ["createdAtFrom", "createdAtTo"],
    properties: {
      createdAtFrom: { type: "string", format: "date-time" },
      createdAtTo: { type: "string", format: "date-time" }
    }
  },
  queryTemplate: {
    queryTemplateVersion: "v1",
    templateText: "select * from purchase_orders where created_at between :createdAtFrom and :createdAtTo",
    allowedParameters: ["createdAtFrom", "createdAtTo"]
  },
  fieldMappings: [
    {
      fieldCode: "orderNo",
      headerName: "Order No",
      fieldType: "STRING",
      orderNo: 1,
      sensitive: false,
      exportable: true
    },
    {
      fieldCode: "contactPhone",
      headerName: "Contact Phone",
      fieldType: "STRING",
      orderNo: 2,
      sensitive: true,
      exportable: true,
      maskingRuleCode: "phone_mask"
    }
  ],
  maskingPolicy: {
    rules: {
      phone_mask: {
        type: "PHONE",
        preservePrefix: 3,
        preserveSuffix: 4
      }
    }
  },
  dataScopeTemplate: "tenant_id = :tenantId and org_id in (:orgScope)",
  cursorField: "orderId",
  orderBy: [
    {
      field: "orderId",
      direction: "ASC"
    }
  ],
  batchSize: 1000
};

const baseCreateRequest: CreateExportTaskRequest = {
  taskCode: "purchase-order-export",
  subsystemCode: "purchase",
  fileFormat: "XLSX",
  clientRequestId: "client-001",
  queryParams: {
    createdAtFrom: "2026-05-01T00:00:00+08:00",
    createdAtTo: "2026-05-13T23:59:59+08:00"
  }
};

function expectErrorCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected error code ${code}`);
}

describe("ExportTaskService", () => {
  let auditLog: AuditLogService;
  let registryService: RegistryConfigService;
  let taskService: ExportTaskService;

  beforeEach(() => {
    auditLog = new AuditLogService();
    registryService = new RegistryConfigService({
      repository: new InMemoryRegistryRepository(),
      auditLog
    });
    taskService = new ExportTaskService({
      repository: new InMemoryExportTaskRepository(),
      registryService,
      auditLog
    });

    registryService.createRegistry(adminContext, baseRegistry);
  });

  it("FR-001 creates a pending task and replays idempotent requests with the same digest", () => {
    const created = taskService.createTask(operatorContext, baseCreateRequest);

    expect(created.status).toBe("PENDING");
    expect(created.idempotencyHit).toBe(false);
    expect(created.idempotencyScope).toBe("tenant-001:user-001:purchase-order-export:client-001");
    expect(created.requestDigest).toMatch(/^sha256:/);
    expect(created.configSnapshotDigest).toMatch(/^sha256:/);
    expect(created.attemptNo).toBe(0);

    const replayed = taskService.createTask(operatorContext, baseCreateRequest);
    expect(replayed.taskId).toBe(created.taskId);
    expect(replayed.idempotencyHit).toBe(true);
    expect(replayed.requestDigest).toBe(created.requestDigest);
  });

  it("FR-013 rejects idempotent replay with a conflicting request digest", () => {
    taskService.createTask(operatorContext, baseCreateRequest);

    expectErrorCode(() =>
      taskService.createTask(operatorContext, {
        ...baseCreateRequest,
        queryParams: {
          ...baseCreateRequest.queryParams,
          createdAtTo: "2026-05-14T23:59:59+08:00"
        }
      }),
      "IDEMPOTENCY_CONFLICT"
    );
  });

  it("FR-002 returns task detail only to visible callers and keeps progress fields", () => {
    const created = taskService.createTask(operatorContext, baseCreateRequest);
    taskService.markTaskExecuting(created.taskId, "worker-a");

    const detail = taskService.getTaskDetail(operatorContext, created.taskId);
    expect(detail.taskId).toBe(created.taskId);
    expect(detail.status).toBe("EXECUTING");
    expect(detail.totalCount).toBe(0);
    expect(detail.processedCount).toBe(0);
    expect(detail.progressPercent).toBe(0);
    expect(detail.createdBy).toBe(operatorContext.operatorId);

    expectErrorCode(
      () => taskService.getTaskDetail(otherOperatorContext, created.taskId),
      "TASK_NOT_FOUND"
    );

    const adminDetail = taskService.getTaskDetail(adminContext, created.taskId);
    expect(adminDetail.taskId).toBe(created.taskId);
  });

  it("FR-004 limits history visibility for operators and allows filtered admin history", () => {
    const ownTask = taskService.createTask(operatorContext, {
      ...baseCreateRequest,
      clientRequestId: "history-own"
    });
    const otherTask = taskService.createTask(otherOperatorContext, {
      ...baseCreateRequest,
      clientRequestId: "history-other"
    });
    taskService.markTaskFailed(otherTask.taskId, {
      errorCode: "QUERY_EXECUTION_ERROR",
      errorMessage: "query failed",
      failureStage: "QUERY_READY"
    });

    const ownHistory = taskService.listTasks(operatorContext, {});
    expect(ownHistory.total).toBe(1);
    expect(ownHistory.items[0]?.taskId).toBe(ownTask.taskId);

    const adminFiltered = taskService.listTasks(adminContext, {
      status: "FAILED",
      createdBy: otherOperatorContext.operatorId
    });
    expect(adminFiltered.total).toBe(1);
    expect(adminFiltered.items[0]?.taskId).toBe(otherTask.taskId);
  });

  it("FR-009 rejects calls without the minimum auth context", () => {
    const invalidContext = {
      ...operatorContext,
      requestId: ""
    };

    expectErrorCode(() => taskService.createTask(invalidContext, baseCreateRequest), "AUTH_CONTEXT_MISSING");

    expectErrorCode(() => registryService.listRegistries(invalidContext, {}), "AUTH_CONTEXT_MISSING");
  });

  it("FR-010 writes auditable create, cancel and retry events with task/request correlation", () => {
    const created = taskService.createTask(operatorContext, baseCreateRequest);
    taskService.cancelTask(operatorContext, created.taskId, { reason: "stop" });
    taskService.markTaskFailed(created.taskId, {
      errorCode: "QUERY_EXECUTION_ERROR",
      errorMessage: "query failed",
      failureStage: "QUERY_READY"
    });
    taskService.retryTask(operatorContext, created.taskId, { reason: "retry" });

    const auditEvents = auditLog.listAuditEvents({ taskId: created.taskId });
    expect(auditEvents.map((event) => event.action)).toEqual([
      "CREATE",
      "CANCEL_REQUEST",
      "CANCEL_DONE",
      "EXECUTE_FAILED",
      "RETRY_REQUEST"
    ]);
    expect(new Set(auditEvents.map((event) => event.requestId))).toEqual(
      new Set([operatorContext.requestId])
    );
    expect(auditEvents.every((event) => event.taskId === created.taskId)).toBe(true);
  });

  it("FR-012 cancels pending tasks immediately and accepts cancel intent for executing tasks", () => {
    const pending = taskService.createTask(operatorContext, {
      ...baseCreateRequest,
      clientRequestId: "cancel-pending"
    });

    const canceledPending = taskService.cancelTask(operatorContext, pending.taskId, { reason: "stop" });
    expect(canceledPending.status).toBe("CANCELED");
    expect(canceledPending.cancelAccepted).toBe(false);

    const executing = taskService.createTask(operatorContext, {
      ...baseCreateRequest,
      clientRequestId: "cancel-executing"
    });
    taskService.markTaskExecuting(executing.taskId, "worker-a");

    const accepted = taskService.cancelTask(operatorContext, executing.taskId, { reason: "stop" });
    expect(accepted.status).toBe("EXECUTING");
    expect(accepted.cancelAccepted).toBe(true);

    expectErrorCode(
      () => taskService.retryTask(operatorContext, executing.taskId, { reason: "retry-now" }),
      "INVALID_TASK_STATE"
    );
  });

  it("FR-012 and FR-013 retry only failed tasks, keep taskId, increment attemptNo and reuse snapshot digest", () => {
    const created = taskService.createTask(operatorContext, {
      ...baseCreateRequest,
      clientRequestId: "retry-failed"
    });

    taskService.markTaskFailed(created.taskId, {
      errorCode: "QUERY_EXECUTION_ERROR",
      errorMessage: "query failed",
      failureStage: "QUERY_READY"
    });

    const retried = taskService.retryTask(operatorContext, created.taskId, { reason: "retry" });

    expect(retried.taskId).toBe(created.taskId);
    expect(retried.retryAccepted).toBe(true);
    expect(retried.status).toBe("PENDING");
    expect(retried.attemptNo).toBe(1);
    expect(retried.configSnapshotDigest).toBe(created.configSnapshotDigest);
  });

  it("FR-013 returns ACTIVE_ATTEMPT_CONFLICT when a failed task already has an active execution attempt", () => {
    const created = taskService.createTask(operatorContext, {
      ...baseCreateRequest,
      clientRequestId: "retry-conflict"
    });
    taskService.markTaskFailed(created.taskId, {
      errorCode: "QUERY_EXECUTION_ERROR",
      errorMessage: "query failed",
      failureStage: "QUERY_READY"
    });
    taskService.forceActiveAttempt(created.taskId, true);

    expectErrorCode(
      () => taskService.retryTask(operatorContext, created.taskId, { reason: "retry" }),
      "ACTIVE_ATTEMPT_CONFLICT"
    );
  });
});
