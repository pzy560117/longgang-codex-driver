ALTER TABLE export_tasks
  ADD COLUMN tenant_id VARCHAR(128) NOT NULL DEFAULT 'default';
