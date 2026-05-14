ALTER TABLE export_tasks
  ADD COLUMN request_payload TEXT,
  ADD COLUMN auth_context_payload TEXT;
