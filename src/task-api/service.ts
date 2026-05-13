import { AuditLogService } from "../audit-log/service.js";
import { RegistryConfigService } from "../registry-config/service.js";
import { fail } from "../shared/errors.js";
import { digest } from "../shared/hash.js";
import type {
  AuthContext,
  CancelTaskRequest,
  CreateExportTaskRequest,
  ExportTask,
  ExportTaskResponse,
  RetryTaskRequest,
  TaskListFilter
} from "../shared/types.js";
import { InMemoryExportTaskRepository } from "./task-repository.js";

interface ExportTaskServiceOptions {
  repository: InMemoryExportTaskRepository;
  registryService: RegistryConfigService;
  auditLog: AuditLogService;
}

interface FailureInput {
  errorCode: string;
  errorMessage: string;
  failureStage: string;
}

export class ExportTaskService {
  private readonly repository: InMemoryExportTaskRepository;
  private readonly registryService: RegistryConfigService;
  private readonly auditLog: AuditLogService;

  constructor(options: ExportTaskServiceOptions) {
    this.repository = options.repository;
    this.registryService = options.registryService;
    this.auditLog = options.auditLog;
  }

  createTask(context: AuthContext, request: CreateExportTaskRequest): ExportTaskResponse {
    this.registryService.assertAuthContext(context);
    const registry = this.registryService.getRegistry(request.taskCode);
    if (!registry.enabled) {
      fail("REGISTRY_DISABLED", "Registry is disabled.");
    }
    if (registry.subsystemCode !== request.subsystemCode || !registry.supportedFormats.includes(request.fileFormat)) {
      fail("INVALID_EXPORT_REQUEST", "Request does not match registry.");
    }

    const idempotencyScope = this.getIdempotencyScope(context, request);
    const requestDigest = digest({
      taskCode: request.taskCode,
      subsystemCode: request.subsystemCode,
      fileFormat: request.fileFormat,
      queryParams: request.queryParams
    });
    const existing = this.repository.findByIdempotencyScope(idempotencyScope);
    if (existing) {
      if (existing.requestDigest !== requestDigest) {
        fail("IDEMPOTENCY_CONFLICT", "Same idempotency scope has a different request digest.");
      }
      return { ...existing, idempotencyHit: true };
    }

    const now = new Date().toISOString();
    const task: ExportTask = {
      taskId: this.repository.nextTaskId(),
      taskCode: request.taskCode,
      subsystemCode: request.subsystemCode,
      tenantId: context.tenantId,
      createdBy: context.operatorId,
      fileFormat: request.fileFormat,
      queryParams: structuredClone(request.queryParams),
      status: "PENDING",
      idempotencyScope,
      requestDigest,
      configSnapshotDigest: registry.configSnapshotDigest,
      attemptNo: 0,
      totalCount: 0,
      processedCount: 0,
      progressPercent: 0,
      createdAt: now,
      updatedAt: now,
      cancelRequested: false,
      activeAttempt: false
    };
    this.repository.save(task);
    this.auditLog.record(context, "CREATE", {
      taskId: task.taskId,
      taskCode: task.taskCode,
      attemptNo: task.attemptNo
    });
    return { ...task, idempotencyHit: false };
  }

  getTaskDetail(context: AuthContext, taskId: string): ExportTaskResponse {
    this.registryService.assertAuthContext(context);
    const task = this.requireVisibleTask(context, taskId);
    return { ...task, idempotencyHit: false };
  }

  listTasks(context: AuthContext, filter: TaskListFilter): { total: number; items: ExportTaskResponse[] } {
    this.registryService.assertAuthContext(context);
    const items = this.repository
      .list()
      .filter((task) => this.canView(context, task))
      .filter((task) => (filter.status ? task.status === filter.status : true))
      .filter((task) => (filter.createdBy ? task.createdBy === filter.createdBy : true))
      .map((task) => ({ ...task, idempotencyHit: false }));
    return { total: items.length, items };
  }

  markTaskExecuting(taskId: string, lockOwner: string): ExportTaskResponse {
    const task = this.requireTask(taskId);
    task.status = "EXECUTING";
    task.lockOwner = lockOwner;
    task.activeAttempt = true;
    task.updatedAt = new Date().toISOString();
    return { ...task, idempotencyHit: false };
  }

  markTaskFailed(taskId: string, failure: FailureInput): ExportTaskResponse {
    const task = this.requireTask(taskId);
    task.status = "FAILED";
    task.activeAttempt = false;
    task.errorCode = failure.errorCode;
    task.errorMessage = failure.errorMessage;
    task.failureStage = failure.failureStage;
    task.updatedAt = new Date().toISOString();
    this.auditLog.record(this.contextFromTask(task), "EXECUTE_FAILED", {
      taskId: task.taskId,
      taskCode: task.taskCode,
      attemptNo: task.attemptNo,
      detail: { ...failure }
    });
    return { ...task, idempotencyHit: false };
  }

  cancelTask(context: AuthContext, taskId: string, request: CancelTaskRequest): ExportTaskResponse {
    this.registryService.assertAuthContext(context);
    const task = this.requireVisibleTask(context, taskId);
    this.auditLog.record(context, "CANCEL_REQUEST", {
      taskId: task.taskId,
      taskCode: task.taskCode,
      attemptNo: task.attemptNo,
      detail: { reason: request.reason }
    });

    if (task.status === "PENDING") {
      task.status = "CANCELED";
      task.cancelRequested = false;
      task.updatedAt = new Date().toISOString();
      this.auditLog.record(context, "CANCEL_DONE", {
        taskId: task.taskId,
        taskCode: task.taskCode,
        attemptNo: task.attemptNo
      });
      return { ...task, idempotencyHit: false, cancelAccepted: false };
    }

    if (task.status === "EXECUTING") {
      task.cancelRequested = true;
      task.updatedAt = new Date().toISOString();
      return { ...task, idempotencyHit: false, cancelAccepted: true };
    }

    fail("INVALID_TASK_STATE", "Only pending or executing tasks can be canceled.");
  }

  retryTask(context: AuthContext, taskId: string, request: RetryTaskRequest): ExportTaskResponse {
    this.registryService.assertAuthContext(context);
    const task = this.requireVisibleTask(context, taskId);
    if (task.status !== "FAILED") {
      fail("INVALID_TASK_STATE", "Only failed tasks can be retried.");
    }
    if (task.activeAttempt) {
      fail("ACTIVE_ATTEMPT_CONFLICT", "Task already has an active attempt.");
    }

    task.status = "PENDING";
    task.attemptNo += 1;
    task.cancelRequested = false;
    task.errorCode = undefined;
    task.errorMessage = undefined;
    task.failureStage = undefined;
    task.updatedAt = new Date().toISOString();
    this.auditLog.record(context, "RETRY_REQUEST", {
      taskId: task.taskId,
      taskCode: task.taskCode,
      attemptNo: task.attemptNo,
      detail: { reason: request.reason }
    });
    return { ...task, idempotencyHit: false, retryAccepted: true };
  }

  forceActiveAttempt(taskId: string, activeAttempt: boolean): void {
    const task = this.requireTask(taskId);
    task.activeAttempt = activeAttempt;
  }

  private getIdempotencyScope(context: AuthContext, request: CreateExportTaskRequest): string {
    return `${context.tenantId}:${context.operatorId}:${request.taskCode}:${request.clientRequestId}`;
  }

  private requireVisibleTask(context: AuthContext, taskId: string): ExportTask {
    const task = this.requireTask(taskId);
    if (!this.canView(context, task)) {
      fail("TASK_NOT_FOUND", "Task does not exist.");
    }
    return task;
  }

  private requireTask(taskId: string): ExportTask {
    return this.repository.findById(taskId) ?? fail("TASK_NOT_FOUND", "Task does not exist.");
  }

  private canView(context: AuthContext, task: ExportTask): boolean {
    if (task.tenantId !== context.tenantId) {
      return false;
    }
    if (context.roleCodes.includes("EXPORT_ADMIN")) {
      return true;
    }
    return task.createdBy === context.operatorId;
  }

  private contextFromTask(task: ExportTask): AuthContext {
    return {
      operatorId: task.createdBy,
      tenantId: task.tenantId,
      roleCodes: ["EXPORT_OPERATOR"],
      orgScope: [],
      requestId: this.latestRequestIdForTask(task)
    };
  }

  private latestRequestIdForTask(task: ExportTask): string {
    const events = this.auditLog.listAuditEvents({ taskId: task.taskId });
    return events.at(-1)?.requestId ?? "system";
  }
}
