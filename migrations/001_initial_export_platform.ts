import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { ExportPlatformDatabase } from "../src/db/schema.ts";

export async function up(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema
    .createTable("export_tasks")
    .addColumn("task_id", "varchar(64)", (column) => column.primaryKey())
    .addColumn("task_code", "varchar(128)", (column) => column.notNull())
    .addColumn("subsystem_code", "varchar(128)", (column) => column.notNull())
    .addColumn("status", "varchar(32)", (column) => column.notNull())
    .addColumn("client_request_id", "varchar(128)")
    .addColumn("idempotency_scope", "varchar(512)")
    .addColumn("request_digest", "varchar(255)", (column) => column.notNull())
    .addColumn("config_snapshot_digest", "varchar(255)", (column) => column.notNull())
    .addColumn("attempt_no", "integer", (column) => column.notNull().defaultTo(0))
    .addColumn("lock_owner", "varchar(255)")
    .addColumn("lock_expire_at", "datetime(3)")
    .addColumn("lease_renewed_at", "datetime(3)")
    .addColumn("created_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .addColumn("updated_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .execute();

  await db.schema
    .createTable("export_task_idempotency")
    .addColumn("idempotency_scope", "varchar(512)", (column) => column.primaryKey())
    .addColumn("task_id", "varchar(64)", (column) => column.notNull())
    .addColumn("request_digest", "varchar(255)", (column) => column.notNull())
    .addColumn("created_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .execute();

  await db.schema
    .createTable("export_registries")
    .addColumn("task_code", "varchar(128)", (column) => column.primaryKey())
    .addColumn("subsystem_code", "varchar(128)", (column) => column.notNull())
    .addColumn("display_name", "varchar(255)", (column) => column.notNull())
    .addColumn("enabled", "boolean", (column) => column.notNull())
    .addColumn("concurrency_limit", "integer", (column) => column.notNull())
    .addColumn("file_retention_days", "integer", (column) => column.notNull())
    .addColumn("task_history_retention_days", "integer", (column) => column.notNull())
    .addColumn("single_file_max_rows", "integer", (column) => column.notNull())
    .addColumn("export_max_rows", "integer", (column) => column.notNull())
    .addColumn("datasource_code", "varchar(128)", (column) => column.notNull())
    .addColumn("config_snapshot_digest", "varchar(255)", (column) => column.notNull())
    .addColumn("created_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .addColumn("updated_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .execute();

  await db.schema
    .createTable("export_registry_versions")
    .addColumn("task_code", "varchar(128)", (column) => column.notNull())
    .addColumn("config_snapshot_digest", "varchar(255)", (column) => column.notNull())
    .addColumn("parameter_schema_digest", "varchar(255)", (column) => column.notNull())
    .addColumn("field_mapping_digest", "varchar(255)", (column) => column.notNull())
    .addColumn("masking_policy_digest", "varchar(255)", (column) => column.notNull())
    .addColumn("created_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .addUniqueConstraint("export_registry_versions_snapshot_uq", [
      "task_code",
      "config_snapshot_digest"
    ])
    .execute();

  await db.schema
    .createTable("export_task_leases")
    .addColumn("task_id", "varchar(64)", (column) => column.notNull())
    .addColumn("attempt_no", "integer", (column) => column.notNull())
    .addColumn("lock_owner", "varchar(255)", (column) => column.notNull())
    .addColumn("lock_expire_at", "datetime(3)", (column) => column.notNull())
    .addColumn("lease_renewed_at", "datetime(3)", (column) => column.notNull())
    .addColumn("database_time", "datetime(3)", (column) => column.notNull())
    .addColumn("takeover_rule", "varchar(255)", (column) => column.notNull())
    .addColumn("created_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .addColumn("updated_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .addPrimaryKeyConstraint("export_task_leases_pk", ["task_id", "attempt_no"])
    .execute();

  await db.schema
    .createTable("export_task_checkpoints")
    .addColumn("task_id", "varchar(64)", (column) => column.notNull())
    .addColumn("attempt_no", "integer", (column) => column.notNull())
    .addColumn("last_cursor", "varchar(255)")
    .addColumn("processed_count", "bigint", (column) => column.notNull().defaultTo(0))
    .addColumn("file_part_no", "integer")
    .addColumn("retry_count", "integer", (column) => column.notNull().defaultTo(0))
    .addColumn("batch_size", "integer")
    .addColumn("batch_row_count", "integer")
    .addColumn("backoff_ms", "integer")
    .addColumn("created_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .addColumn("updated_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .addPrimaryKeyConstraint("export_task_checkpoints_pk", ["task_id", "attempt_no"])
    .execute();

  await db.schema
    .createTable("export_task_files")
    .addColumn("task_id", "varchar(64)", (column) => column.notNull())
    .addColumn("attempt_no", "integer", (column) => column.notNull())
    .addColumn("file_name", "varchar(255)", (column) => column.notNull())
    .addColumn("content_type", "varchar(255)", (column) => column.notNull())
    .addColumn("file_size", "bigint", (column) => column.notNull())
    .addColumn("checksum", "varchar(255)", (column) => column.notNull())
    .addColumn("checksum_algorithm", "varchar(32)", (column) => column.notNull())
    .addColumn("temp_storage_key", "varchar(512)")
    .addColumn("published_storage_key", "varchar(512)")
    .addColumn("expires_at", "datetime(3)", (column) => column.notNull())
    .addColumn("published_at", "datetime(3)")
    .addColumn("delivery_ready_at", "datetime(3)")
    .addColumn("checksum_verified_at", "datetime(3)")
    .addColumn("created_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .addColumn("updated_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .addPrimaryKeyConstraint("export_task_files_pk", ["task_id", "attempt_no"])
    .execute();

  await db.schema
    .createTable("export_audit_logs")
    .addColumn("audit_id", "varchar(64)", (column) => column.primaryKey())
    .addColumn("task_id", "varchar(64)")
    .addColumn("attempt_no", "integer")
    .addColumn("task_code", "varchar(128)")
    .addColumn("subsystem_code", "varchar(128)")
    .addColumn("operator_id", "varchar(128)", (column) => column.notNull())
    .addColumn("action", "varchar(64)", (column) => column.notNull())
    .addColumn("result", "varchar(32)", (column) => column.notNull())
    .addColumn("error_code", "varchar(64)", (column) => column.notNull())
    .addColumn("request_id", "varchar(128)", (column) => column.notNull())
    .addColumn("occurred_at", "datetime(3)", (column) => column.notNull())
    .addColumn("created_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .execute();
}

export async function down(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema.dropTable("export_audit_logs").ifExists().execute();
  await db.schema.dropTable("export_task_files").ifExists().execute();
  await db.schema.dropTable("export_task_checkpoints").ifExists().execute();
  await db.schema.dropTable("export_task_leases").ifExists().execute();
  await db.schema.dropTable("export_registry_versions").ifExists().execute();
  await db.schema.dropTable("export_registries").ifExists().execute();
  await db.schema.dropTable("export_task_idempotency").ifExists().execute();
  await db.schema.dropTable("export_tasks").ifExists().execute();
}
