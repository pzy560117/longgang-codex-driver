import mysql from "mysql2/promise";

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

type DatasourceUrlMap = Record<string, string | { url?: string }>;

export function createEnvReadonlyDatasourceAdapterProvider(input?: {
  env?: NodeJS.ProcessEnv;
}): ReadonlyDatasourceAdapterProvider {
  const env = input?.env ?? process.env;
  return {
    async resolveReadonlyAdapter(datasourceCode) {
      const datasourceUrl = resolveDatasourceUrl(env, datasourceCode);
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
  env: NodeJS.ProcessEnv,
  datasourceCode: string
): string | undefined {
  const directKey = `EXPORT_PLATFORM_DATASOURCE_${toEnvKey(datasourceCode)}_URL`;
  const direct = env[directKey];
  if (direct) {
    return direct;
  }

  const mapped = resolveDatasourceUrlFromMap(env.EXPORT_PLATFORM_DATASOURCES_JSON, datasourceCode);
  if (mapped) {
    return mapped;
  }

  return undefined;
}

function resolveDatasourceUrlFromMap(
  payload: string | undefined,
  datasourceCode: string
): string | undefined {
  if (!payload) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(payload) as DatasourceUrlMap;
    const value = parsed[datasourceCode];
    if (typeof value === "string") {
      return value;
    }
    return typeof value?.url === "string" ? value.url : undefined;
  } catch {
    return undefined;
  }
}

function toEnvKey(datasourceCode: string): string {
  return datasourceCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
