import { createMigrationDatabase } from "../src/db/index.ts";
import { listMigrations, migrateToLatest } from "../src/db/migrator.ts";

type Command = "latest" | "list";

const command = parseCommand(process.argv.slice(2));

try {
  const db = createMigrationDatabase();
  if (command === "list") {
    try {
      const migrations = await listMigrations(db);
      console.log(
        JSON.stringify({
          event: "export-platform.db-migration.plan",
          total: migrations.length,
          pending: migrations.filter((migration) => migration.pending).length,
          migrations: migrations.map((migration) => ({
            name: migration.name,
            status: migration.pending ? "PENDING" : "EXECUTED",
            executedAt: migration.executedAt?.toISOString()
          }))
        })
      );
    } finally {
      await db.destroy();
    }
  } else {
    try {
      const result = await migrateToLatest(db);
      console.log(
        JSON.stringify({
          event: "export-platform.db-migration.completed",
          executed: result.results.filter((migration) => migration.status === "Success").length,
          results: result.results.map((migration) => ({
            name: migration.migrationName,
            direction: migration.direction,
            status: migration.status
          }))
        })
      );
    } finally {
      await db.destroy();
    }
  }
} catch (error) {
  console.error(
    JSON.stringify({
      event: "export-platform.db-migration.failed",
      command,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? sanitizeErrorMessage(error.message) : "Unknown error"
    })
  );
  process.exitCode = 1;
}

function parseCommand(args: string[]): Command {
  if (args.length === 0) {
    return "latest";
  }

  const [firstArg] = args;
  if (firstArg === "latest" || firstArg === "list") {
    return firstArg;
  }

  throw new Error("Usage: npm run db:migrate -- [latest|list]");
}

function sanitizeErrorMessage(message: string): string {
  return message.replace(/mysql:\/\/[^\s"']+/gi, "mysql://<redacted>");
}
