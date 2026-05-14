import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../src/db/schema.ts";

export async function up(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema
    .alterTable("export_tasks")
    .addColumn("request_payload", "text")
    .addColumn("auth_context_payload", "text")
    .execute();
}

export async function down(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  await db.schema.alterTable("export_tasks").dropColumn("auth_context_payload").execute();
  await db.schema.alterTable("export_tasks").dropColumn("request_payload").execute();
}
