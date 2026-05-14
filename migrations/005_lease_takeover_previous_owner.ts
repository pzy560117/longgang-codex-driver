import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../src/db/schema.ts";

export async function up(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema
    .alterTable("export_task_leases")
    .addColumn("previous_lock_owner", "varchar(255)")
    .execute();
}

export async function down(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema.alterTable("export_task_leases").dropColumn("previous_lock_owner").execute();
}
