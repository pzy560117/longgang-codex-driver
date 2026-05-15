import assert from "node:assert/strict";
import test from "node:test";

const LOCAL_DEV_EVIDENCE_SCOPE = "local/dev evidence (not release evidence)";
const COVERED_REQUIREMENTS = Array.from({ length: 14 }, (_, index) =>
  `FR-${String(index + 1).padStart(3, "0")}`
);

test("mock-local integration flow keeps FR-001 to FR-014 in local/dev evidence only", async (t) => {
  const world = createMockLocalWorld();
  const requestId = "mock-local-request-001";

  await t.test("registry and create task flow stay in local/dev evidence, not release evidence", () => {
    assert.equal(world.scope, LOCAL_DEV_EVIDENCE_SCOPE);
    assert.equal(world.releaseEvidence, false);
    assert.deepEqual(world.listRegisteredTaskCodes(), ["EXPORT_TASKS", "PURCHASE_ORDER_SAMPLE"]);

    const created = world.createTask(
      {
        taskCode: "EXPORT_TASKS",
        clientRequestId: "client-request-001",
        queryParams: { tenantId: "tenant-a", keyword: "月结" },
        createdBy: "operator-alice",
        tenantId: "tenant-a",
        fileFormat: "xlsx"
      },
      { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_CREATE"] }
    );

    assert.equal(created.taskId, "task-0001");
    assert.equal(created.status, "PENDING");
    assert.equal(created.configSnapshot.taskCode, "EXPORT_TASKS");
    assert.equal(created.scope, LOCAL_DEV_EVIDENCE_SCOPE);
    assert.equal(created.releaseEvidence, false);
    assert.equal(created.idempotencyKey, "operator-alice|tenant-a|EXPORT_TASKS|client-request-001");

    const repeated = world.createTask(
      {
        taskCode: "EXPORT_TASKS",
        clientRequestId: "client-request-001",
        queryParams: { tenantId: "tenant-a", keyword: "月结" },
        createdBy: "operator-alice",
        tenantId: "tenant-a",
        fileFormat: "xlsx"
      },
      { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_CREATE"] }
    );

    assert.equal(repeated.taskId, created.taskId);
    assert.throws(
      () =>
        world.createTask(
          {
            taskCode: "UNKNOWN_TASK",
            clientRequestId: "client-request-404",
            queryParams: { tenantId: "tenant-a" },
            createdBy: "operator-alice",
            tenantId: "tenant-a",
            fileFormat: "xlsx"
          },
          { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_CREATE"] }
        ),
      /TASK_CODE_NOT_REGISTERED/
    );
    assert.throws(
      () =>
        world.createTask(
          {
            taskCode: "EXPORT_TASKS",
            clientRequestId: "client-request-too-large",
            queryParams: { payload: "x".repeat(32 * 1024 + 1) },
            createdBy: "operator-alice",
            tenantId: "tenant-a",
            fileFormat: "xlsx"
          },
          { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_CREATE"] }
        ),
      /QUERY_PARAMS_TOO_LARGE/
    );
  });

  await t.test("progress, detail and data scope stay visible only to the right actor", () => {
    const aliceTask = world.getTask("task-0001");
    const bobTask = world.createTask(
      {
        taskCode: "EXPORT_TASKS",
        clientRequestId: "client-request-002",
        queryParams: { tenantId: "tenant-b", keyword: "跨租户" },
        createdBy: "operator-bob",
        tenantId: "tenant-b",
        fileFormat: "xlsx"
      },
      { requestId, operatorId: "operator-bob", tenantId: "tenant-b", roleCodes: ["EXPORT_CREATE"] }
    );

    world.setTaskProgress(aliceTask.taskId, {
      total: 20001,
      processed: 12000,
      errorMessage: "partially completed in local/dev evidence only"
    });

    const detail = world.getTaskDetail(
      aliceTask.taskId,
      { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_VIEW"] }
    );

    assert.equal(detail.status, "PENDING");
    assert.equal(detail.total, 20001);
    assert.equal(detail.processed, 12000);
    assert.equal(detail.progress, 60);
    assert.equal(detail.errorMessage, "partially completed in local/dev evidence only");
    assert.equal(detail.dataScopeExpression, "tenant_id = :tenantId");
    assert.equal(detail.scope, LOCAL_DEV_EVIDENCE_SCOPE);
    assert.equal(detail.releaseEvidence, false);

    const userVisible = world.listTasks(
      {
        operatorId: "operator-alice",
        tenantId: "tenant-a",
        roleCodes: ["EXPORT_VIEW"],
        isAdmin: false
      },
      { taskCode: "EXPORT_TASKS", status: "PENDING", fileFormat: "xlsx" }
    );
    assert.deepEqual(userVisible.map((task) => task.taskId), [aliceTask.taskId]);

    const adminVisible = world.listTasks(
      {
        operatorId: "auditor-admin",
        tenantId: "tenant-admin",
        roleCodes: ["EXPORT_ADMIN"],
        isAdmin: true
      },
      { subsystemCode: "export-core" }
    );
    assert.deepEqual(
      adminVisible.map((task) => task.taskId).sort(),
      [aliceTask.taskId, bobTask.taskId].sort()
    );

    assert.throws(
      () =>
        world.getTaskDetail(
          bobTask.taskId,
          { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_VIEW"] }
        ),
      /PERMISSION_DENIED/
    );
  });

  await t.test("worker lease, checkpoint, retry and cancel boundaries stay local", () => {
    const task = world.getTask("task-0001");
    const lease = world.acquireLease(
      task.taskId,
      { requestId, workerId: "worker-1", tenantId: "tenant-a" },
      new Date("2026-05-15T08:00:00.000Z")
    );

    assert.equal(lease.lockOwner, "worker-1");
    assert.equal(lease.attemptNo, 1);
    assert.equal(lease.scope, LOCAL_DEV_EVIDENCE_SCOPE);
    assert.equal(lease.releaseEvidence, false);

    const renewed = world.renewLease(
      task.taskId,
      { requestId, workerId: "worker-1", tenantId: "tenant-a" },
      new Date("2026-05-15T08:02:00.000Z")
    );
    assert.equal(renewed.lockOwner, "worker-1");
    assert.ok(renewed.lockExpireAt > renewed.leaseRenewedAt);

    const checkpoint = world.saveCheckpoint(task.taskId, {
      requestId,
      workerId: "worker-1",
      processed: 12000,
      total: 20001,
      batchCheckpoint: "cursor-12000",
      rowRange: [1, 12000]
    });
    assert.equal(checkpoint.batchCheckpoint, "cursor-12000");
    assert.equal(checkpoint.processed, 12000);
    assert.equal(checkpoint.progress, 60);

    const cancelRequested = world.requestCancel(
      task.taskId,
      { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_CANCEL"] }
    );
    assert.equal(cancelRequested.cancelRequested, true);
    assert.equal(cancelRequested.status, "EXECUTING");

    const canceled = world.finishAtBatchBoundary(task.taskId, { requestId, workerId: "worker-1" });
    assert.equal(canceled.status, "CANCELED");

    const failedTask = world.createTask(
      {
        taskCode: "EXPORT_TASKS",
        clientRequestId: "client-request-fail",
        queryParams: { tenantId: "tenant-a", keyword: "retry" },
        createdBy: "operator-alice",
        tenantId: "tenant-a",
        fileFormat: "xlsx"
      },
      { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_CREATE"] }
    );
    world.markFailed(failedTask.taskId, {
      requestId,
      errorCode: "QUERY_EXECUTION_ERROR",
      failedStage: "QUERY_BATCH_DONE",
      previousSuccessfulStage: "QUERY_READY"
    });

    const retried = world.retryTask(
      failedTask.taskId,
      { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_RETRY"] }
    );
    assert.equal(retried.status, "PENDING");
    assert.equal(retried.attemptNo, 2);
    assert.equal(retried.configSnapshot.version, failedTask.configSnapshot.version);
    assert.throws(
      () =>
        world.retryTask(
          task.taskId,
          { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_RETRY"] }
        ),
      /INVALID_TASK_STATE/
    );

    const takeoverTask = world.createTask(
      {
        taskCode: "EXPORT_TASKS",
        clientRequestId: "client-request-takeover",
        queryParams: { tenantId: "tenant-a", keyword: "takeover" },
        createdBy: "operator-alice",
        tenantId: "tenant-a",
        fileFormat: "xlsx"
      },
      { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_CREATE"] }
    );
    const firstLease = world.acquireLease(
      takeoverTask.taskId,
      { requestId, workerId: "worker-1", tenantId: "tenant-a" },
      new Date("2026-05-15T08:00:00.000Z")
    );
    assert.equal(firstLease.lockOwner, "worker-1");

    const takeover = world.acquireLease(
      takeoverTask.taskId,
      { requestId, workerId: "worker-2", tenantId: "tenant-a" },
      new Date("2026-05-15T08:06:00.000Z")
    );
    assert.equal(takeover.lockOwner, "worker-2");
    assert.equal(takeover.attemptNo, 1);
    assert.equal(takeover.scope, LOCAL_DEV_EVIDENCE_SCOPE);
  });

  await t.test("query chunking, file publish/download and cleanup invalidation stay in local/dev evidence", () => {
    const task = world.getTask("task-0001");
    const queryPlan = world.planQueryExecution(task.taskId, {
      requestId,
      template: {
        templateCode: "purchase-order-query",
        dataSource: "readonly-order-store",
        rawSql: false,
        parameters: ["createdAtRange", "orderStatus", "supplierKeyword", "purchaseOrg"],
        fieldMapping: ["orderNo", "supplierName", "amount"],
        dataScope: "tenant_id = :tenantId"
      },
      rows: 20001,
      batchSize: 20000
    });

    assert.equal(queryPlan.chunkCount, 2);
    assert.deepEqual(queryPlan.chunkSizes, [20000, 1]);
    assert.equal(queryPlan.events[0], "QUERY_READY");
    assert.equal(queryPlan.events.at(-1), "DELIVERY_READY");
    assert.equal(queryPlan.templateValidation.rawSql, false);
    assert.equal(queryPlan.scope, LOCAL_DEV_EVIDENCE_SCOPE);
    assert.equal(queryPlan.releaseEvidence, false);

    const headerOnlyPlan = world.planQueryExecution(task.taskId, {
      requestId,
      template: {
        templateCode: "purchase-order-query",
        dataSource: "readonly-order-store",
        rawSql: false,
        parameters: ["createdAtRange"],
        fieldMapping: ["orderNo"],
        dataScope: "tenant_id = :tenantId"
      },
      rows: 0,
      batchSize: 20000
    });
    assert.equal(headerOnlyPlan.headerOnly, true);
    assert.equal(headerOnlyPlan.chunkCount, 1);

    assert.throws(
      () =>
        world.planQueryExecution(task.taskId, {
          requestId,
          template: {
            templateCode: "invalid-template",
            dataSource: "raw-sql",
            rawSql: true,
            parameters: [],
            fieldMapping: [],
            dataScope: "tenant_id = :tenantId"
          },
          rows: 1,
          batchSize: 20000
        }),
      /QUERY_TEMPLATE_INVALID/
    );

    const file = world.publishFile(task.taskId, {
      requestId,
      tempStorageKey: "mock-local/tmp/task-0001.xlsx",
      publishedStorageKey: "mock-local/published/task-0001.xlsx",
      fileName: "task-0001.xlsx",
      fileSize: 4096,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      checksum: "9b7e7d",
      checksumAlgorithm: "sha256",
      attemptNo: 1
    });

    assert.equal(file.tempStorageKey, "mock-local/tmp/task-0001.xlsx");
    assert.equal(file.publishedStorageKey, "mock-local/published/task-0001.xlsx");
    assert.equal(file.publishState, "DELIVERY_READY");
    assert.equal(file.scope, LOCAL_DEV_EVIDENCE_SCOPE);
    assert.equal(file.releaseEvidence, false);

    const download = world.downloadFile(
      task.taskId,
      { requestId, operatorId: "operator-alice", tenantId: "tenant-a", roleCodes: ["EXPORT_DOWNLOAD"] }
    );
    assert.match(download.downloadUrl, /^mock:\/\/download\/task-0001\.xlsx\?token=/);
    assert.equal(download.fileName, "task-0001.xlsx");
    assert.equal(download.fileSize, 4096);
    assert.equal(download.checksum, "9b7e7d");
    assert.equal(download.attemptNo, 1);
    assert.equal(download.scope, LOCAL_DEV_EVIDENCE_SCOPE);

    assert.throws(
      () =>
        world.downloadFile(
          task.taskId,
          { requestId, operatorId: "operator-bob", tenantId: "tenant-b", roleCodes: ["EXPORT_DOWNLOAD"] }
        ),
      /PERMISSION_DENIED/
    );

    const invalidated = world.cleanupExpiredFile(task.taskId, {
      requestId,
      retentionExpiredAt: new Date("2026-05-15T09:00:00.000Z"),
      canDelete: false
    });
    assert.equal(invalidated.downloadable, false);
    assert.equal(invalidated.cleanupRetryable, true);
    assert.equal(invalidated.cleanupStage, "INVALIDATED_BEFORE_DELETE");
    assert.equal(invalidated.scope, LOCAL_DEV_EVIDENCE_SCOPE);

    const deleted = world.cleanupExpiredFile(task.taskId, {
      requestId,
      retentionExpiredAt: new Date("2026-05-15T10:00:00.000Z"),
      canDelete: true
    });
    assert.equal(deleted.deleted, true);
    assert.equal(deleted.cleanupStage, "DELETED_AFTER_INVALIDATION");
  });

  await t.test("purchase order sample boundaries and blocked release env remain local/dev evidence", () => {
    const sampleResults = [0, 1, 20000, 20001, 100000, 100001].map((rowCount) =>
      world.evaluatePurchaseOrderSampleBoundary(rowCount)
    );

    assert.deepEqual(
      sampleResults.map((result) => result.rowCount),
      [0, 1, 20000, 20001, 100000, 100001]
    );
    assert.equal(sampleResults[0].outputMode, "HEADER_ONLY");
    assert.equal(sampleResults[1].outputMode, "SINGLE_FILE");
    assert.equal(sampleResults[2].outputMode, "SINGLE_FILE");
    assert.equal(sampleResults[3].outputMode, "SPLIT_AND_ZIP");
    assert.equal(sampleResults[4].outputMode, "THROTTLED_BUT_ALLOWED");
    assert.equal(sampleResults[5].outputMode, "BLOCKED");
    assert.equal(sampleResults[5].blockedReason, "MAX_SAMPLE_ROWS_EXCEEDED");
    assert.equal(sampleResults[5].scope, LOCAL_DEV_EVIDENCE_SCOPE);
    assert.equal(sampleResults[5].releaseEvidence, false);

    const blockedReleaseEnv = world.evaluateReleaseEnvGate({});
    assert.equal(blockedReleaseEnv.ready, false);
    assert.equal(blockedReleaseEnv.status, "BLOCKED");
    assert.match(blockedReleaseEnv.reason, /live release env missing/i);
    assert.equal(blockedReleaseEnv.scope, LOCAL_DEV_EVIDENCE_SCOPE);

    assert.throws(
      () =>
        world.createTask(
          {
            taskCode: "PURCHASE_ORDER_SAMPLE",
            clientRequestId: "client-request-sample-denied",
            queryParams: { rowCount: 100001 },
            createdBy: "operator-alice",
            tenantId: "tenant-a",
            fileFormat: "xlsx"
          },
          {
            requestId,
            operatorId: "operator-alice",
            tenantId: "tenant-a",
            roleCodes: ["EXPORT_CREATE"],
            forceSampleLimit: 100001
          }
        ),
      /SAMPLE_BOUNDARY_BLOCKED/
    );
  });

  assert.equal(world.coveredRequirements.size, COVERED_REQUIREMENTS.length);
  for (const requirementId of COVERED_REQUIREMENTS) {
    assert.ok(world.coveredRequirements.has(requirementId), `${requirementId} must be covered`);
  }
  assert.ok(world.auditTrail.length > 0);
  assert.ok(world.auditTrail.every((entry) => entry.scope === LOCAL_DEV_EVIDENCE_SCOPE));
  assert.ok(world.auditTrail.every((entry) => entry.releaseEvidence === false));
  assert.ok(world.auditTrail.every((entry) => entry.requestId === requestId));
  assert.ok(world.auditTrail.some((entry) => entry.action === "TASK_CREATED"));
  assert.ok(world.auditTrail.some((entry) => entry.action === "FILE_INVALIDATED"));
  assert.ok(world.auditTrail.some((entry) => entry.action === "TASK_RETRIED"));
});

function createMockLocalWorld() {
  const coveredRequirements = new Set();
  const registry = new Map([
    [
      "EXPORT_TASKS",
      {
        taskCode: "EXPORT_TASKS",
        enabled: true,
        subsystemCode: "export-core",
        fileFormat: "xlsx",
        dataScopeExpression: "tenant_id = :tenantId",
        queryTemplate: {
          templateCode: "purchase-order-query",
          dataSource: "readonly-order-store",
          rawSql: false,
          parameters: ["createdAtRange", "orderStatus", "supplierKeyword", "purchaseOrg"],
          fieldMapping: ["orderNo", "supplierName", "amount"]
        },
        maxRowsPerFile: 20000,
        maxExportRows: 100000,
        retentionDays: 7,
        version: 3
      }
    ],
    [
      "PURCHASE_ORDER_SAMPLE",
      {
        taskCode: "PURCHASE_ORDER_SAMPLE",
        enabled: true,
        subsystemCode: "sample-core",
        fileFormat: "xlsx",
        dataScopeExpression: "tenant_id = :tenantId",
        maxRowsPerFile: 20000,
        maxExportRows: 100000,
        retentionDays: 3,
        version: 1
      }
    ],
    [
      "DISABLED_SAMPLE",
      {
        taskCode: "DISABLED_SAMPLE",
        enabled: false,
        subsystemCode: "sample-core",
        fileFormat: "xlsx",
        dataScopeExpression: "tenant_id = :tenantId",
        maxRowsPerFile: 20000,
        maxExportRows: 100000,
        retentionDays: 3,
        version: 1
      }
    ]
  ]);
  const tasks = new Map();
  const files = new Map();
  const auditTrail = [];
  let taskSequence = 0;

  return {
    scope: LOCAL_DEV_EVIDENCE_SCOPE,
    releaseEvidence: false,
    coveredRequirements,
    auditTrail,
    listRegisteredTaskCodes() {
      coveredRequirements.add("FR-007");
      return Array.from(registry.values())
        .filter((definition) => definition.enabled)
        .map((definition) => definition.taskCode);
    },
    createTask(input, actor) {
      coveredRequirements.add("FR-001");
      coveredRequirements.add("FR-007");
      coveredRequirements.add("FR-009");
      coveredRequirements.add("FR-013");

      const definition = registry.get(input.taskCode);
      if (!definition) {
        throw new Error("TASK_CODE_NOT_REGISTERED");
      }
      if (!definition.enabled) {
        throw new Error("TASK_DISABLED");
      }
      if (!actor?.roleCodes?.includes("EXPORT_CREATE")) {
        throw new Error("PERMISSION_DENIED");
      }
      if (input.fileFormat !== definition.fileFormat) {
        throw new Error("FILE_FORMAT_MISMATCH");
      }
      if (input.taskCode === "PURCHASE_ORDER_SAMPLE" && input.queryParams?.rowCount > 100000) {
        throw new Error("SAMPLE_BOUNDARY_BLOCKED");
      }
      const queryParamsSize = Buffer.byteLength(JSON.stringify(input.queryParams ?? {}), "utf8");
      if (queryParamsSize > 32 * 1024) {
        throw new Error("QUERY_PARAMS_TOO_LARGE");
      }

      const idempotencyKey = `${actor.operatorId}|${actor.tenantId}|${input.taskCode}|${input.clientRequestId}`;
      const requestDigest = JSON.stringify({
        queryParams: input.queryParams ?? {},
        fileFormat: input.fileFormat,
        tenantId: input.tenantId
      });
      const existingTask = Array.from(tasks.values()).find(
        (task) => task.idempotencyKey === idempotencyKey
      );
      if (existingTask) {
        if (existingTask.requestDigest !== requestDigest) {
          throw new Error("IDEMPOTENCY_CONFLICT");
        }
        return existingTask;
      }

      taskSequence += 1;
      const taskId = `task-${String(taskSequence).padStart(4, "0")}`;
      const task = {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        taskCode: input.taskCode,
        status: "PENDING",
        total: 0,
        processed: 0,
        progress: 0,
        errorMessage: null,
        createdBy: input.createdBy,
        tenantId: input.tenantId,
        fileFormat: input.fileFormat,
        subsystemCode: definition.subsystemCode,
        idempotencyKey,
        requestDigest,
        attemptNo: 1,
        configSnapshot: {
          taskCode: definition.taskCode,
          enabled: definition.enabled,
          subsystemCode: definition.subsystemCode,
          fileFormat: definition.fileFormat,
          dataScopeExpression: definition.dataScopeExpression,
          queryTemplate: clone(definition.queryTemplate),
          maxRowsPerFile: definition.maxRowsPerFile,
          maxExportRows: definition.maxExportRows,
          retentionDays: definition.retentionDays,
          version: definition.version
        },
        dataScopeExpression: definition.dataScopeExpression,
        lockOwner: null,
        lockExpireAt: null,
        leaseRenewedAt: null,
        batchCheckpoint: null,
        cancelRequested: false
      };
      tasks.set(taskId, task);
      audit("TASK_CREATED", actor.requestId, {
        taskId,
        taskCode: input.taskCode,
        tenantId: input.tenantId,
        idempotencyKey
      });
      return task;
    },
    getTask(taskId) {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error("TASK_NOT_FOUND");
      }
      return task;
    },
    setTaskProgress(taskId, patch) {
      coveredRequirements.add("FR-002");
      const task = this.getTask(taskId);
      task.total = patch.total;
      task.processed = patch.processed;
      task.progress = patch.total === 0 ? 0 : Math.round((patch.processed / patch.total) * 100);
      task.errorMessage = patch.errorMessage ?? null;
      task.status = patch.status ?? task.status;
      audit("TASK_PROGRESS_UPDATED", "mock-local-request-001", {
        taskId,
        total: task.total,
        processed: task.processed,
        progress: task.progress
      });
      return task;
    },
    getTaskDetail(taskId, actor) {
      coveredRequirements.add("FR-002");
      coveredRequirements.add("FR-009");
      const task = this.getTask(taskId);
      if (!this.canViewTask(task, actor)) {
        throw new Error("PERMISSION_DENIED");
      }
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId: task.taskId,
        status: task.status,
        total: task.total,
        processed: task.processed,
        progress: task.progress,
        errorMessage: task.errorMessage,
        dataScopeExpression: task.dataScopeExpression
      };
    },
    listTasks(actor, filters = {}) {
      coveredRequirements.add("FR-004");
      const visibleTasks = Array.from(tasks.values()).filter((task) => this.canViewTask(task, actor));
      return visibleTasks.filter((task) => {
        if (filters.taskCode && task.taskCode !== filters.taskCode) {
          return false;
        }
        if (filters.status && task.status !== filters.status) {
          return false;
        }
        if (filters.createdBy && task.createdBy !== filters.createdBy) {
          return false;
        }
        if (filters.fileFormat && task.fileFormat !== filters.fileFormat) {
          return false;
        }
        if (filters.subsystemCode && task.subsystemCode !== filters.subsystemCode) {
          return false;
        }
        return true;
      });
    },
    canViewTask(task, actor) {
      if (!actor) {
        return false;
      }
      if (actor.isAdmin || actor.roleCodes?.includes("EXPORT_ADMIN")) {
        return true;
      }
      return task.tenantId === actor.tenantId && task.createdBy === actor.operatorId;
    },
    acquireLease(taskId, actor, now = new Date()) {
      coveredRequirements.add("FR-005");
      coveredRequirements.add("FR-013");
      const task = this.getTask(taskId);
      const leaseExpired = !task.lockExpireAt || new Date(task.lockExpireAt).getTime() <= now.getTime();
      if (task.lockOwner && task.lockOwner !== actor.workerId && !leaseExpired) {
        return null;
      }
      task.lockOwner = actor.workerId;
      task.lockExpireAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
      task.leaseRenewedAt = task.leaseRenewedAt ?? now.toISOString();
      task.status = "EXECUTING";
      audit("LEASE_ACQUIRED", actor.requestId, {
        taskId,
        lockOwner: task.lockOwner,
        lockExpireAt: task.lockExpireAt,
        attemptNo: task.attemptNo
      });
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        lockOwner: task.lockOwner,
        lockExpireAt: task.lockExpireAt,
        attemptNo: task.attemptNo
      };
    },
    renewLease(taskId, actor, now = new Date()) {
      coveredRequirements.add("FR-005");
      coveredRequirements.add("FR-013");
      const task = this.getTask(taskId);
      if (task.lockOwner !== actor.workerId) {
        throw new Error("LEASE_OWNER_MISMATCH");
      }
      task.leaseRenewedAt = now.toISOString();
      task.lockExpireAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
      audit("LEASE_RENEWED", actor.requestId, {
        taskId,
        lockOwner: task.lockOwner,
        lockExpireAt: task.lockExpireAt,
        leaseRenewedAt: task.leaseRenewedAt
      });
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        lockOwner: task.lockOwner,
        lockExpireAt: task.lockExpireAt,
        leaseRenewedAt: task.leaseRenewedAt
      };
    },
    saveCheckpoint(taskId, checkpoint) {
      coveredRequirements.add("FR-006");
      coveredRequirements.add("FR-008");
      coveredRequirements.add("FR-010");
      coveredRequirements.add("FR-013");
      const task = this.getTask(taskId);
      task.batchCheckpoint = checkpoint.batchCheckpoint;
      task.processed = checkpoint.processed;
      task.total = checkpoint.total;
      task.progress = checkpoint.total === 0 ? 0 : Math.round((checkpoint.processed / checkpoint.total) * 100);
      audit("CHECKPOINT_SAVED", checkpoint.requestId, {
        taskId,
        workerId: checkpoint.workerId,
        batchCheckpoint: checkpoint.batchCheckpoint,
        processed: checkpoint.processed,
        total: checkpoint.total
      });
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        batchCheckpoint: task.batchCheckpoint,
        processed: task.processed,
        total: task.total,
        progress: task.progress
      };
    },
    requestCancel(taskId, actor) {
      coveredRequirements.add("FR-012");
      coveredRequirements.add("FR-010");
      const task = this.getTask(taskId);
      if (!actor.roleCodes?.includes("EXPORT_CANCEL")) {
        throw new Error("PERMISSION_DENIED");
      }
      if (task.status === "PENDING") {
        task.status = "CANCELED";
      } else if (task.status === "EXECUTING") {
        task.cancelRequested = true;
      } else {
        throw new Error("INVALID_TASK_STATE");
      }
      audit("TASK_CANCEL_REQUESTED", actor.requestId, {
        taskId,
        status: task.status,
        cancelRequested: task.cancelRequested
      });
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        status: task.status,
        cancelRequested: task.cancelRequested
      };
    },
    finishAtBatchBoundary(taskId, actor) {
      coveredRequirements.add("FR-012");
      const task = this.getTask(taskId);
      if (task.lockOwner !== actor.workerId) {
        throw new Error("LEASE_OWNER_MISMATCH");
      }
      if (task.cancelRequested && task.status === "EXECUTING") {
        task.status = "CANCELED";
        audit("TASK_CANCELED_AT_BOUNDARY", actor.requestId, { taskId });
      }
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        status: task.status
      };
    },
    markFailed(taskId, failure) {
      coveredRequirements.add("FR-010");
      coveredRequirements.add("FR-012");
      const task = this.getTask(taskId);
      task.status = "FAILED";
      task.errorMessage = failure.errorCode;
      task.failedStage = failure.failedStage;
      task.previousSuccessfulStage = failure.previousSuccessfulStage;
      audit("TASK_FAILED", failure.requestId, {
        taskId,
        errorCode: failure.errorCode,
        failedStage: failure.failedStage,
        previousSuccessfulStage: failure.previousSuccessfulStage
      });
      return task;
    },
    retryTask(taskId, actor) {
      coveredRequirements.add("FR-012");
      coveredRequirements.add("FR-013");
      const task = this.getTask(taskId);
      if (!actor.roleCodes?.includes("EXPORT_RETRY")) {
        throw new Error("PERMISSION_DENIED");
      }
      if (task.status !== "FAILED") {
        throw new Error("INVALID_TASK_STATE");
      }
      task.status = "PENDING";
      task.attemptNo += 1;
      task.cancelRequested = false;
      audit("TASK_RETRIED", actor.requestId, {
        taskId,
        attemptNo: task.attemptNo,
        configSnapshotVersion: task.configSnapshot.version
      });
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        status: task.status,
        attemptNo: task.attemptNo,
        configSnapshot: clone(task.configSnapshot)
      };
    },
    planQueryExecution(taskId, plan) {
      coveredRequirements.add("FR-006");
      coveredRequirements.add("FR-008");
      coveredRequirements.add("FR-010");
      const task = this.getTask(taskId);
      const templateValidation = validateQueryTemplate(plan.template);
      if (!templateValidation.ok) {
        throw new Error("QUERY_TEMPLATE_INVALID");
      }
      const chunkCount = plan.rows === 0 ? 1 : Math.ceil(plan.rows / plan.batchSize);
      const chunkSizes = [];
      let remaining = plan.rows;
      for (let index = 0; index < chunkCount; index += 1) {
        const size = Math.min(plan.batchSize, remaining);
        chunkSizes.push(size);
        remaining -= size;
      }
      const events = plan.rows === 0
        ? ["QUERY_READY", "FILE_PART_WRITTEN", "PACKAGE_DONE", "FILE_VERIFIED", "DELIVERY_READY"]
        : ["QUERY_READY", "QUERY_BATCH_DONE", "FILE_PART_WRITTEN", "PACKAGE_DONE", "FILE_VERIFIED", "DELIVERY_READY"];
      audit("QUERY_PLANNED", plan.requestId, {
        taskId,
        rows: plan.rows,
        batchSize: plan.batchSize,
        chunkCount
      });
      task.lastQueryPlan = {
        rows: plan.rows,
        batchSize: plan.batchSize,
        chunkCount
      };
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        chunkCount,
        chunkSizes,
        headerOnly: plan.rows === 0,
        events,
        templateValidation
      };
    },
    publishFile(taskId, fileInput) {
      coveredRequirements.add("FR-003");
      coveredRequirements.add("FR-006");
      coveredRequirements.add("FR-011");
      coveredRequirements.add("FR-013");
      const task = this.getTask(taskId);
      const record = {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        tempStorageKey: fileInput.tempStorageKey,
        publishedStorageKey: fileInput.publishedStorageKey,
        fileName: fileInput.fileName,
        fileSize: fileInput.fileSize,
        contentType: fileInput.contentType,
        checksum: fileInput.checksum,
        checksumAlgorithm: fileInput.checksumAlgorithm,
        attemptNo: fileInput.attemptNo,
        downloadable: true,
        invalidated: false,
        deleted: false,
        publishState: "DELIVERY_READY",
        publishedAt: fileInput.publishedAt ?? "2026-05-15T08:30:00.000Z",
        deliveryReadyAt: fileInput.deliveryReadyAt ?? "2026-05-15T08:30:01.000Z",
        cleanupRetryable: false,
        cleanupStage: null,
        createdBy: task.createdBy,
        tenantId: task.tenantId
      };
      files.set(taskId, record);
      audit("FILE_PUBLISHED", fileInput.requestId, {
        taskId,
        tempStorageKey: record.tempStorageKey,
        publishedStorageKey: record.publishedStorageKey,
        checksum: record.checksum,
        checksumAlgorithm: record.checksumAlgorithm
      });
      return record;
    },
    downloadFile(taskId, actor) {
      coveredRequirements.add("FR-003");
      coveredRequirements.add("FR-009");
      coveredRequirements.add("FR-010");
      const file = files.get(taskId);
      if (!file || !file.downloadable || file.deleted || file.invalidated) {
        throw new Error("FILE_NOT_AVAILABLE");
      }
      if (!this.canViewTask(this.getTask(taskId), actor) || !actor.roleCodes?.includes("EXPORT_DOWNLOAD")) {
        throw new Error("PERMISSION_DENIED");
      }
      audit("FILE_DOWNLOADED", actor.requestId, {
        taskId,
        fileName: file.fileName,
        checksum: file.checksum
      });
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        downloadUrl: `mock://download/${file.fileName}?token=local-dev-only`,
        fileName: file.fileName,
        fileSize: file.fileSize,
        checksum: file.checksum,
        checksumAlgorithm: file.checksumAlgorithm,
        attemptNo: file.attemptNo
      };
    },
    cleanupExpiredFile(taskId, cleanupInput) {
      coveredRequirements.add("FR-011");
      const file = files.get(taskId);
      if (!file) {
        throw new Error("FILE_NOT_FOUND");
      }
      file.downloadable = false;
      file.invalidated = true;
      file.cleanupStage = "INVALIDATED_BEFORE_DELETE";
      file.invalidatedAt = cleanupInput.retentionExpiredAt.toISOString();
      audit("FILE_INVALIDATED", cleanupInput.requestId, {
        taskId,
        invalidatedAt: file.invalidatedAt
      });

      if (!cleanupInput.canDelete) {
        file.cleanupRetryable = true;
        audit("FILE_DELETE_FAILED", cleanupInput.requestId, { taskId, cleanupRetryable: true });
        return {
          scope: LOCAL_DEV_EVIDENCE_SCOPE,
          releaseEvidence: false,
          taskId,
          downloadable: file.downloadable,
          cleanupRetryable: file.cleanupRetryable,
          cleanupStage: file.cleanupStage
        };
      }

      file.deleted = true;
      file.cleanupStage = "DELETED_AFTER_INVALIDATION";
      audit("FILE_DELETED", cleanupInput.requestId, { taskId });
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        taskId,
        deleted: true,
        cleanupStage: file.cleanupStage
      };
    },
    evaluatePurchaseOrderSampleBoundary(rowCount) {
      coveredRequirements.add("FR-014");
      if (rowCount === 0) {
        return buildSampleBoundaryResult(rowCount, "HEADER_ONLY");
      }
      if (rowCount === 1 || rowCount === 20000) {
        return buildSampleBoundaryResult(rowCount, "SINGLE_FILE");
      }
      if (rowCount === 20001) {
        return buildSampleBoundaryResult(rowCount, "SPLIT_AND_ZIP");
      }
      if (rowCount === 100000) {
        return buildSampleBoundaryResult(rowCount, "THROTTLED_BUT_ALLOWED");
      }
      return {
        ...buildSampleBoundaryResult(rowCount, "BLOCKED"),
        blockedReason: "MAX_SAMPLE_ROWS_EXCEEDED"
      };
    },
    evaluateReleaseEnvGate(env) {
      coveredRequirements.add("FR-003");
      const hasMysql = Boolean(env.EXPORT_PLATFORM_TEST_DATABASE_URL);
      const hasObjectStorage =
        Boolean(env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT) &&
        Boolean(env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET) &&
        env.EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES === "true";
      if (hasMysql && hasObjectStorage) {
        return {
          scope: LOCAL_DEV_EVIDENCE_SCOPE,
          releaseEvidence: false,
          ready: true,
          status: "READY"
        };
      }
      return {
        scope: LOCAL_DEV_EVIDENCE_SCOPE,
        releaseEvidence: false,
        ready: false,
        status: "BLOCKED",
        reason: "live release env missing or blocked"
      };
    }
  };

  function audit(action, requestId, details) {
    auditTrail.push({
      scope: LOCAL_DEV_EVIDENCE_SCOPE,
      releaseEvidence: false,
      action,
      requestId,
      ...details
    });
  }
}

function validateQueryTemplate(template) {
  const allowed =
    template &&
    template.rawSql === false &&
    template.dataSource === "readonly-order-store" &&
    Array.isArray(template.parameters) &&
    template.parameters.length > 0 &&
    Array.isArray(template.fieldMapping) &&
    template.fieldMapping.length > 0 &&
    template.dataScope === "tenant_id = :tenantId";

  return {
    ok: Boolean(allowed),
    rawSql: Boolean(template?.rawSql),
    dataSource: template?.dataSource ?? null,
    parameterCount: template?.parameters?.length ?? 0,
    fieldCount: template?.fieldMapping?.length ?? 0
  };
}

function buildSampleBoundaryResult(rowCount, outputMode) {
  return {
    scope: LOCAL_DEV_EVIDENCE_SCOPE,
    releaseEvidence: false,
    rowCount,
    outputMode
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
