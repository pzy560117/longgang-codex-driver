import { Migrator, type Kysely, type Migration, type MigrationProvider } from "kysely";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExportPlatformDatabase } from "./schema.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationFolder = path.join(root, "migrations");

class FileUrlMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    const migrations: Record<string, Migration> = {};
    const files = await fs.readdir(migrationFolder);

    for (const fileName of files) {
      if (!isExecutableMigrationFile(fileName)) {
        continue;
      }

      const migrationUrl = pathToFileURL(path.join(migrationFolder, fileName)).href;
      const migration = await import(migrationUrl);
      const migrationKey = fileName.slice(0, fileName.lastIndexOf("."));

      if (isMigration(migration.default)) {
        migrations[migrationKey] = migration.default;
      } else if (isMigration(migration)) {
        migrations[migrationKey] = migration;
      }
    }

    return migrations;
  }
}

function isExecutableMigrationFile(fileName: string): boolean {
  return (
    fileName.endsWith(".js") ||
    (fileName.endsWith(".ts") && !fileName.endsWith(".d.ts")) ||
    fileName.endsWith(".mjs") ||
    (fileName.endsWith(".mts") && !fileName.endsWith(".d.mts"))
  );
}

function isMigration(value: unknown): value is Migration {
  return (
    typeof value === "object" &&
    value !== null &&
    "up" in value &&
    typeof value.up === "function"
  );
}

export async function runMigrations(db: Kysely<ExportPlatformDatabase>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new FileUrlMigrationProvider()
  });

  const { error, results } = await migrator.migrateToLatest();

  if (error) {
    throw error;
  }

  for (const result of results ?? []) {
    if (result.status === "Error") {
      throw new Error(`Migration ${result.migrationName} failed`);
    }
  }
}
