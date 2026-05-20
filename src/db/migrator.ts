import type { Kysely } from "kysely";
import {
  Migrator,
  type Migration,
  type MigrationInfo,
  type MigrationProvider,
  type MigrationResult
} from "kysely/migration";
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

export type MigrationPlanItem = {
  name: string;
  executedAt?: Date;
  pending: boolean;
};

export type MigrationRunResult = {
  results: readonly MigrationResult[];
};

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
  await migrateToLatest(db);
}

export async function listMigrations(
  db: Kysely<ExportPlatformDatabase>
): Promise<MigrationPlanItem[]> {
  const migrator = createMigrator(db);
  const migrations = await migrator.getMigrations();
  return migrations.map(toMigrationPlanItem);
}

export async function migrateToLatest(
  db: Kysely<ExportPlatformDatabase>
): Promise<MigrationRunResult> {
  const migrator = createMigrator(db);
  const { error, results } = await migrator.migrateToLatest();

  if (error) {
    throw error;
  }

  for (const result of results ?? []) {
    if (result.status === "Error") {
      throw new Error(`Migration ${result.migrationName} failed`);
    }
  }

  return {
    results: results ?? []
  };
}

function createMigrator(db: Kysely<ExportPlatformDatabase>): Migrator {
  const migrator = new Migrator({
    db,
    provider: new FileUrlMigrationProvider()
  });

  return migrator;
}

function toMigrationPlanItem(migration: MigrationInfo): MigrationPlanItem {
  return {
    name: migration.name,
    executedAt: migration.executedAt,
    pending: migration.executedAt === undefined
  };
}
