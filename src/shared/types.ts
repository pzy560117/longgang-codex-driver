export type ExportTaskStatus = "PENDING" | "EXECUTING" | "SUCCESS" | "FAILED" | "CANCELED";
export type ExportFileFormat = "XLSX" | "ZIP";
export type FieldType = "STRING" | "NUMBER" | "DATE" | "DATETIME" | "BOOLEAN";
export type AuditAction =
  | "CREATE"
  | "CANCEL_REQUEST"
  | "CANCEL_DONE"
  | "EXECUTE_FAILED"
  | "RETRY_REQUEST"
  | "REGISTRY_CREATE"
  | "REGISTRY_UPDATE"
  | "REGISTRY_ENABLE"
  | "REGISTRY_DISABLE";

export interface AuthContext {
  operatorId: string;
  tenantId: string;
  roleCodes: string[];
  orgScope: string[];
  requestId: string;
}

export interface CreateExportTaskRequest {
  taskCode: string;
  subsystemCode: string;
  fileFormat: ExportFileFormat;
  clientRequestId: string;
  queryParams: Record<string, unknown>;
}

export interface ExportRegistryUpsertRequest {
  taskCode: string;
  subsystemCode: string;
  displayName: string;
  enabled: boolean;
  concurrencyLimit: number;
  fileRetentionDays: number;
  taskHistoryRetentionDays: number;
  singleFileMaxRows: number;
  exportMaxRows: number;
  supportedFormats: ExportFileFormat[];
  datasourceCode: string;
  parameterSchema: Record<string, unknown>;
  queryTemplate: {
    queryTemplateVersion: string;
    templateText: string;
    allowedParameters: string[];
  };
  fieldMappings: Array<{
    fieldCode: string;
    headerName: string;
    fieldType: FieldType;
    orderNo: number;
    sensitive: boolean;
    exportable: boolean;
    maskingRuleCode?: string;
  }>;
  maskingPolicy: Record<string, unknown>;
  dataScopeTemplate: string;
  cursorField: string;
  orderBy: Array<{
    field: string;
    direction: "ASC" | "DESC";
  }>;
  batchSize: number;
}

export interface ExportRegistry extends ExportRegistryUpsertRequest {
  configSnapshotDigest: string;
  parameterSchemaDigest: string;
  fieldMappingDigest: string;
  maskingPolicyDigest: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportTask {
  taskId: string;
  taskCode: string;
  subsystemCode: string;
  tenantId: string;
  createdBy: string;
  fileFormat: ExportFileFormat;
  queryParams: Record<string, unknown>;
  status: ExportTaskStatus;
  idempotencyScope: string;
  requestDigest: string;
  configSnapshotDigest: string;
  attemptNo: number;
  totalCount: number;
  processedCount: number;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  lockOwner?: string;
  cancelRequested: boolean;
  activeAttempt: boolean;
  errorCode?: string;
  errorMessage?: string;
  failureStage?: string;
}

export interface ExportTaskResponse extends ExportTask {
  idempotencyHit: boolean;
  cancelAccepted?: boolean;
  retryAccepted?: boolean;
}

export interface TaskListFilter {
  status?: ExportTaskStatus;
  createdBy?: string;
}

export interface CancelTaskRequest {
  reason: string;
}

export interface RetryTaskRequest {
  reason: string;
}

export interface AuditEvent {
  action: AuditAction;
  taskId?: string;
  taskCode?: string;
  attemptNo?: number;
  requestId: string;
  operatorId: string;
  tenantId: string;
  occurredAt: string;
  detail?: Record<string, unknown>;
}
