import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../src/db/schema.ts";

export async function up(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema
    .alterTable("export_tasks")
    .addColumn("created_by", "varchar(128)", (column) => column.notNull().defaultTo("system"))
    .addColumn("file_format", "varchar(16)", (column) => column.notNull().defaultTo("XLSX"))
    .execute();
}

export async function down(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema.alterTable("export_tasks").dropColumn("file_format").execute();
  await db.schema.alterTable("export_tasks").dropColumn("created_by").execute();
}
