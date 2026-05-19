import mysql from "mysql2/promise";
import { loadConfig, type DatasourceConfig } from "../config/index.ts";

export type ReadonlyDatasourceAdapter = {
  executeSelect(
    sqlText: string,
    values: readonly unknown[]
  ): Promise<Record<string, unknown>[]>;
};

export type ReadonlyDatasourceAdapterProvider = {
  resolveReadonlyAdapter(
    datasourceCode: string
  ): Promise<ReadonlyDatasourceAdapter | undefined>;
};

export function createEnvReadonlyDatasourceAdapterProvider(input?: {
  env?: NodeJS.ProcessEnv;
  datasource?: DatasourceConfig;
}): ReadonlyDatasourceAdapterProvider {
  const datasource = input?.datasource ?? loadConfig(input?.env).datasource;
  return {
    async resolveReadonlyAdapter(datasourceCode) {
      const datasourceUrl = resolveDatasourceUrl(datasource, datasourceCode);
      if (!datasourceUrl) {
        return undefined;
      }
      return createMysqlReadonlyDatasourceAdapter(datasourceUrl);
    }
  };
}

export function createMysqlReadonlyDatasourceAdapter(
  datasourceUrl: string
): ReadonlyDatasourceAdapter {
  return {
    async executeSelect(sqlText, values) {
      const connection = await mysql.createConnection(datasourceUrl);
      try {
        await connection.query("SET TRANSACTION READ ONLY");
        await connection.beginTransaction();
        const [rows] = await connection.query(sqlText, [...values]);
        await connection.commit();
        return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
      } catch (error) {
        try {
          await connection.rollback();
        } catch {
          // The original datasource error is more useful to the caller.
        }
        throw error;
      } finally {
        await connection.end();
      }
    }
  };
}

function resolveDatasourceUrl(
  datasource: DatasourceConfig,
  datasourceCode: string
): string | undefined {
  return datasource.urlsByCode[datasourceCode] ?? datasource.urlsByCode[toEnvKey(datasourceCode)];
}

function toEnvKey(datasourceCode: string): string {
  return datasourceCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
