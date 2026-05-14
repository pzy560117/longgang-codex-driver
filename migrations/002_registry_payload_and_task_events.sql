ALTER TABLE export_registries
  ADD COLUMN supported_formats TEXT,
  ADD COLUMN parameter_schema TEXT,
  ADD COLUMN query_template TEXT,
  ADD COLUMN field_mappings TEXT,
  ADD COLUMN masking_policy TEXT,
  ADD COLUMN data_scope_template TEXT,
  ADD COLUMN cursor_field VARCHAR(128),
  ADD COLUMN order_by VARCHAR(255),
  ADD COLUMN batch_size INT;

CREATE TABLE export_task_events (
  event_id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  attempt_no INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  request_id VARCHAR(128) NOT NULL,
  datasource_code VARCHAR(128),
  query_template_version VARCHAR(255),
  batch_checkpoint TEXT,
  occurred_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL
);
