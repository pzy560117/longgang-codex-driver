import { sql, type Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";

export async function getDatabaseTime(db: Kysely<ExportPlatformDatabase>): Promise<Date> {
  const row = await sql<{ database_time: Date }>`SELECT CURRENT_TIMESTAMP(3) AS database_time`
    .execute(db)
    .then((result) => result.rows[0]);

  if (!row?.database_time) {
    throw new Error("Database time query returned no rows");
  }

  return new Date(row.database_time);
}
