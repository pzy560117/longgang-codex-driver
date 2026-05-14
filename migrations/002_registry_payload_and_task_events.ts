import { sql, type Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../src/db/schema.ts";

export async function up(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema
    .alterTable("export_registries")
    .addColumn("supported_formats", "text")
    .addColumn("parameter_schema", "text")
    .addColumn("query_template", "text")
    .addColumn("field_mappings", "text")
    .addColumn("masking_policy", "text")
    .addColumn("data_scope_template", "text")
    .addColumn("cursor_field", "varchar(128)")
    .addColumn("order_by", "varchar(255)")
    .addColumn("batch_size", "integer")
    .execute();

  await db.schema
    .createTable("export_task_events")
    .addColumn("event_id", "varchar(64)", (column) => column.primaryKey())
    .addColumn("task_id", "varchar(64)", (column) => column.notNull())
    .addColumn("attempt_no", "integer", (column) => column.notNull())
    .addColumn("event_type", "varchar(64)", (column) => column.notNull())
    .addColumn("request_id", "varchar(128)", (column) => column.notNull())
    .addColumn("datasource_code", "varchar(128)")
    .addColumn("query_template_version", "varchar(255)")
    .addColumn("batch_checkpoint", "text")
    .addColumn("occurred_at", "datetime(3)", (column) => column.notNull())
    .addColumn("created_at", "datetime(3)", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`)
    )
    .execute();
}

export async function down(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema.dropTable("export_task_events").ifExists().execute();
  await db.schema.alterTable("export_registries").dropColumn("batch_size").execute();
  await db.schema.alterTable("export_registries").dropColumn("order_by").execute();
  await db.schema.alterTable("export_registries").dropColumn("cursor_field").execute();
  await db.schema.alterTable("export_registries").dropColumn("data_scope_template").execute();
  await db.schema.alterTable("export_registries").dropColumn("masking_policy").execute();
  await db.schema.alterTable("export_registries").dropColumn("field_mappings").execute();
  await db.schema.alterTable("export_registries").dropColumn("query_template").execute();
  await db.schema.alterTable("export_registries").dropColumn("parameter_schema").execute();
  await db.schema.alterTable("export_registries").dropColumn("supported_formats").execute();
}
