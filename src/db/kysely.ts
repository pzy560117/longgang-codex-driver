import { Kysely, MysqlDialect, type MysqlDialectConfig } from "kysely";
import mysql from "mysql2";
import {
  loadConfig,
  loadDatabaseConfig,
  type DatabaseRuntimeConfig,
  type ExportPlatformConfig
} from "../config/index.ts";
import type { ExportPlatformDatabase } from "./schema.ts";

export type MysqlPoolOptions = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: {};
};

export function createMysqlPoolOptions(
  config: ExportPlatformConfig | DatabaseRuntimeConfig
): MysqlPoolOptions {
  return {
    host: config.mysql.host,
    port: config.mysql.port,
    database: config.mysql.database,
    user: config.mysql.user,
    password: config.mysql.password,
    ssl: config.mysql.ssl ? {} : undefined
  };
}

export function createDatabase(): Kysely<ExportPlatformDatabase> {
  const config = loadConfig();

  return createDatabaseFromConfig(config);
}

export function createMigrationDatabase(): Kysely<ExportPlatformDatabase> {
  const config = loadDatabaseConfig();

  return createDatabaseFromConfig(config);
}

function createDatabaseFromConfig(
  config: ExportPlatformConfig | DatabaseRuntimeConfig
): Kysely<ExportPlatformDatabase> {
  return new Kysely<ExportPlatformDatabase>({
    dialect: new MysqlDialect({
      pool: mysql.createPool(createMysqlPoolOptions(config)) as unknown as MysqlDialectConfig["pool"]
    })
  });
}
