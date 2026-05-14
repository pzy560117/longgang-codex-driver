export interface ExportTasksTable {
  task_id: string;
  task_code: string;
  subsystem_code: string;
  status: string;
  client_request_id: string | null;
  idempotency_scope: string | null;
  request_digest: string;
  config_snapshot_digest: string;
  attempt_no: number;
  lock_owner: string | null;
  lock_expire_at: Date | null;
  lease_renewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExportRegistriesTable {
  task_code: string;
  subsystem_code: string;
  display_name: string;
  enabled: number | boolean;
  concurrency_limit: number;
  file_retention_days: number;
  task_history_retention_days: number;
  single_file_max_rows: number;
  export_max_rows: number;
  datasource_code: string;
  supported_formats: string | null;
  parameter_schema: string | null;
  query_template: string | null;
  field_mappings: string | null;
  masking_policy: string | null;
  data_scope_template: string | null;
  cursor_field: string | null;
  order_by: string | null;
  batch_size: number | null;
  config_snapshot_digest: string;
  created_at: Date;
  updated_at: Date;
}

export interface ExportTaskIdempotencyTable {
  idempotency_scope: string;
  task_id: string;
  request_digest: string;
  created_at: Date;
}

export interface ExportRegistryVersionsTable {
  task_code: string;
  config_snapshot_digest: string;
  parameter_schema_digest: string;
  field_mapping_digest: string;
  masking_policy_digest: string;
  created_at: Date;
}

export interface ExportTaskLeasesTable {
  task_id: string;
  attempt_no: number;
  lock_owner: string;
  lock_expire_at: Date;
  lease_renewed_at: Date;
  database_time: Date;
  takeover_rule: string;
  created_at: Date;
  updated_at: Date;
}

export interface ExportTaskCheckpointsTable {
  task_id: string;
  attempt_no: number;
  last_cursor: string | null;
  processed_count: number;
  file_part_no: number | null;
  retry_count: number;
  batch_size: number | null;
  batch_row_count: number | null;
  backoff_ms: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExportTaskFilesTable {
  task_id: string;
  attempt_no: number;
  file_name: string;
  content_type: string;
  file_size: number;
  checksum: string;
  checksum_algorithm: string;
  temp_storage_key: string | null;
  published_storage_key: string | null;
  expires_at: Date;
  published_at: Date | null;
  delivery_ready_at: Date | null;
  checksum_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExportAuditLogsTable {
  audit_id: string;
  task_id: string | null;
  attempt_no: number | null;
  task_code: string | null;
  subsystem_code: string | null;
  operator_id: string;
  action: string;
  result: string;
  error_code: string;
  request_id: string;
  occurred_at: Date;
  created_at: Date;
}

export interface ExportTaskEventsTable {
  event_id: string;
  task_id: string;
  attempt_no: number;
  event_type: string;
  request_id: string;
  datasource_code: string | null;
  query_template_version: string | null;
  batch_checkpoint: string | null;
  occurred_at: Date;
  created_at: Date;
}

export interface ExportPlatformDatabase {
  export_tasks: ExportTasksTable;
  export_task_idempotency: ExportTaskIdempotencyTable;
  export_registries: ExportRegistriesTable;
  export_registry_versions: ExportRegistryVersionsTable;
  export_task_leases: ExportTaskLeasesTable;
  export_task_checkpoints: ExportTaskCheckpointsTable;
  export_task_files: ExportTaskFilesTable;
  export_task_events: ExportTaskEventsTable;
  export_audit_logs: ExportAuditLogsTable;
}
