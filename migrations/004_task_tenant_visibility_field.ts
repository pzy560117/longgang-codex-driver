import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../src/db/schema.ts";

export async function up(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema
    .alterTable("export_tasks")
    .addColumn("tenant_id", "varchar(128)", (column) => column.notNull().defaultTo("default"))
    .execute();
}

export async function down(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema.alterTable("export_tasks").dropColumn("tenant_id").execute();
}
