CREATE TABLE export_tasks (
  task_id VARCHAR(64) PRIMARY KEY,
  task_code VARCHAR(128) NOT NULL,
  subsystem_code VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  client_request_id VARCHAR(128),
  idempotency_scope VARCHAR(512),
  request_digest VARCHAR(255) NOT NULL,
  config_snapshot_digest VARCHAR(255) NOT NULL,
  attempt_no INT NOT NULL DEFAULT 0,
  lock_owner VARCHAR(255),
  lock_expire_at DATETIME(3),
  lease_renewed_at DATETIME(3),
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL
);

CREATE TABLE export_task_idempotency (
  idempotency_scope VARCHAR(512) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  request_digest VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL
);

CREATE TABLE export_registries (
  task_code VARCHAR(128) PRIMARY KEY,
  subsystem_code VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL,
  concurrency_limit INT NOT NULL,
  file_retention_days INT NOT NULL,
  task_history_retention_days INT NOT NULL,
  single_file_max_rows INT NOT NULL,
  export_max_rows INT NOT NULL,
  datasource_code VARCHAR(128) NOT NULL,
  config_snapshot_digest VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL
);

CREATE TABLE export_registry_versions (
  task_code VARCHAR(128) NOT NULL,
  config_snapshot_digest VARCHAR(255) NOT NULL,
  parameter_schema_digest VARCHAR(255) NOT NULL,
  field_mapping_digest VARCHAR(255) NOT NULL,
  masking_policy_digest VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_export_registry_versions_snapshot (task_code, config_snapshot_digest)
);

CREATE TABLE export_task_leases (
  task_id VARCHAR(64) NOT NULL,
  attempt_no INT NOT NULL,
  lock_owner VARCHAR(255) NOT NULL,
  lock_expire_at DATETIME(3) NOT NULL,
  lease_renewed_at DATETIME(3) NOT NULL,
  database_time DATETIME(3) NOT NULL,
  takeover_rule VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (task_id, attempt_no)
);

CREATE TABLE export_task_checkpoints (
  task_id VARCHAR(64) NOT NULL,
  attempt_no INT NOT NULL,
  last_cursor VARCHAR(255),
  processed_count BIGINT NOT NULL,
  file_part_no INT,
  retry_count INT NOT NULL DEFAULT 0,
  batch_size INT,
  batch_row_count INT,
  backoff_ms INT,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (task_id, attempt_no)
);

CREATE TABLE export_task_files (
  task_id VARCHAR(64) NOT NULL,
  attempt_no INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  checksum VARCHAR(255) NOT NULL,
  checksum_algorithm VARCHAR(32) NOT NULL,
  temp_storage_key VARCHAR(512),
  published_storage_key VARCHAR(512),
  expires_at DATETIME(3) NOT NULL,
  published_at DATETIME(3),
  delivery_ready_at DATETIME(3),
  checksum_verified_at DATETIME(3),
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (task_id, attempt_no)
);

CREATE TABLE export_audit_logs (
  audit_id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64),
  attempt_no INT,
  task_code VARCHAR(128),
  subsystem_code VARCHAR(128),
  operator_id VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL,
  result VARCHAR(32) NOT NULL,
  error_code VARCHAR(64) NOT NULL,
  request_id VARCHAR(128) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL
);
