type ConfigEnv = NodeJS.ProcessEnv;

export type RuntimeEnvironment = "local" | "test" | "staging" | "pre-prod" | "production";

export type HttpConfig = {
  host: string;
  port: number;
};

export type MysqlConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  source: "database-url" | "split";
};

export type SchedulerConfig = {
  pollIntervalMs: number;
};

export type CleanupConfig = {
  pollIntervalMs: number;
};

export type DatasourceConfig = {
  urlsByCode: Record<string, string>;
};

export type ObjectStorageConfig = {
  endpoint?: string;
  bucket?: string;
  allowLocalSmoke: boolean;
  allowSmokeWrites: boolean;
  smokePrefix: string;
};

export type SecurityConfig = {
  downloadUrlSigningSecret?: string;
  authContextSigningSecret?: string;
  registryAdminTenantIds: string[];
  publicBaseUrl: string;
};

export type WorkerConfig = {
  schedulerWorkerId: string;
  cleanupWorkerId: string;
};

export type SecurityPolicyConfig = {
  productionFailFast: boolean;
  rejectUnsafeProductionEndpoints: boolean;
  requireExplicitSmokeWrites: boolean;
};

export type ExportPlatformConfig = {
  serviceName: "export-platform";
  deliveryShape: "independent_microservice";
  environment: RuntimeEnvironment;
  host: string;
  port: number;
  http: HttpConfig;
  databaseUrl?: string;
  mysql: MysqlConfig;
  schedulerPollIntervalMs: number;
  scheduler: SchedulerConfig;
  cleanupPollIntervalMs: number;
  cleanup: CleanupConfig;
  datasource: DatasourceConfig;
  objectStorage: ObjectStorageConfig;
  security: SecurityConfig;
  worker: WorkerConfig;
  securityPolicy: SecurityPolicyConfig;
};

export type DatabaseRuntimeConfig = {
  environment: RuntimeEnvironment;
  databaseUrl?: string;
  mysql: MysqlConfig;
};

function readInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer configuration value: ${value}`);
  }

  return parsed;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      throw new Error(`Invalid boolean configuration value: ${value}`);
  }
}

function readEnvironment(value: string | undefined): RuntimeEnvironment {
  const normalized = (value ?? "local").trim().toLowerCase();
  switch (normalized) {
    case "local":
    case "development":
    case "dev":
      return "local";
    case "test":
      return "test";
    case "staging":
      return "staging";
    case "pre-prod":
    case "preprod":
      return "pre-prod";
    case "production":
    case "prod":
      return "production";
    default:
      throw new Error(`Invalid runtime environment configuration value: ${value}`);
  }
}

function readCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDatasourceCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readDatasourceConfig(env: ConfigEnv): DatasourceConfig {
  const urlsByCode: Record<string, string> = {};
  const jsonValue = env.EXPORT_PLATFORM_DATASOURCES_JSON;
  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue) as Record<string, string | { url?: string }>;
      for (const [code, value] of Object.entries(parsed)) {
        const url = typeof value === "string" ? value : value?.url;
        if (url) {
          urlsByCode[code] = url;
        }
      }
    } catch {
      throw new Error("Invalid datasource map configuration: EXPORT_PLATFORM_DATASOURCES_JSON");
    }
  }

  for (const [key, value] of Object.entries(env)) {
    const match = /^EXPORT_PLATFORM_DATASOURCE_(.+)_URL$/.exec(key);
    if (!match || !value) {
      continue;
    }
    urlsByCode[normalizeDatasourceCode(match[1])] = value;
  }

  return { urlsByCode };
}

function readObjectStorageConfig(env: ConfigEnv): ObjectStorageConfig {
  return {
    endpoint: env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT,
    bucket: env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET,
    allowLocalSmoke: readBoolean(env.EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE, false),
    allowSmokeWrites: readBoolean(env.EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES, false),
    smokePrefix: (env.EXPORT_PLATFORM_OBJECT_STORAGE_SMOKE_PREFIX ?? "release-smoke")
      .replace(/^\/+|\/+$/g, "")
  };
}

function readSecurityConfig(env: ConfigEnv): SecurityConfig {
  return {
    downloadUrlSigningSecret: env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET,
    authContextSigningSecret: env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET,
    registryAdminTenantIds: readCsv(env.EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS),
    publicBaseUrl: env.EXPORT_PLATFORM_PUBLIC_BASE_URL ?? "http://export-platform.local"
  };
}

function readWorkerConfig(env: ConfigEnv): WorkerConfig {
  return {
    schedulerWorkerId: env.EXPORT_PLATFORM_WORKER_ID ?? `scheduler-${process.pid}`,
    cleanupWorkerId: env.EXPORT_PLATFORM_CLEANUP_WORKER_ID ?? `cleanup-${process.pid}`
  };
}

function loadMysqlConfig(env: ConfigEnv): MysqlConfig {
  const databaseUrl = env.EXPORT_PLATFORM_DATABASE_URL;
  if (databaseUrl) {
    const url = new URL(databaseUrl);

    return {
      host: url.hostname || "127.0.0.1",
      port: readInt(url.port || undefined, 3306),
      database: url.pathname.replace(/^\/+/, "") || "export_platform",
      user: decodeURIComponent(url.username || "root"),
      password: decodeURIComponent(url.password || ""),
      ssl: readBoolean(url.searchParams.get("ssl") ?? undefined, false),
      source: "database-url"
    };
  }

  return {
    host: env.EXPORT_PLATFORM_MYSQL_HOST ?? "127.0.0.1",
    port: readInt(env.EXPORT_PLATFORM_MYSQL_PORT, 3306),
    database: env.EXPORT_PLATFORM_MYSQL_DATABASE ?? "export_platform",
    user: env.EXPORT_PLATFORM_MYSQL_USER ?? "root",
    password: env.EXPORT_PLATFORM_MYSQL_PASSWORD ?? "",
    ssl: readBoolean(env.EXPORT_PLATFORM_MYSQL_SSL, false),
    source: "split"
  };
}

function assertRequiredProductionSecret(name: string, value: string | undefined): void {
  if (!value?.trim()) {
    throw new Error(`Missing required production secret: ${name}`);
  }
}

function assertRequiredProductionValue(name: string, value: string | undefined): void {
  if (!value?.trim()) {
    throw new Error(`Missing required production configuration: ${name}`);
  }
}

function assertSafeProductionEndpoint(name: string, value: string | undefined): void {
  assertRequiredProductionValue(name, value);
  const url = new URL(value!);
  assertSafeProductionHost(name, url.hostname, value);
}

function assertSafeProductionHost(name: string, hostValue: string | undefined, rawValue?: string): void {
  assertRequiredProductionValue(name, hostValue);
  const host = hostValue!.toLowerCase();
  const displayValue = rawValue ?? hostValue!;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.includes("example") ||
    host.endsWith(".invalid") ||
    host.endsWith(".test")
  ) {
    throw new Error(`Unsafe production endpoint for ${name}: ${displayValue}`);
  }
}

function assertProductionMysqlConfig(
  config: Pick<ExportPlatformConfig, "databaseUrl" | "mysql">,
  env: ConfigEnv
): void {
  if (config.databaseUrl) {
    assertSafeProductionEndpoint("EXPORT_PLATFORM_DATABASE_URL", config.databaseUrl);
    return;
  }

  for (const name of [
    "EXPORT_PLATFORM_MYSQL_HOST",
    "EXPORT_PLATFORM_MYSQL_PORT",
    "EXPORT_PLATFORM_MYSQL_DATABASE",
    "EXPORT_PLATFORM_MYSQL_USER",
    "EXPORT_PLATFORM_MYSQL_PASSWORD",
    "EXPORT_PLATFORM_MYSQL_SSL"
  ]) {
    assertRequiredProductionValue(name, env[name]);
  }

  assertSafeProductionHost("EXPORT_PLATFORM_MYSQL_HOST", config.mysql.host);
  assertRequiredProductionSecret("EXPORT_PLATFORM_MYSQL_PASSWORD", config.mysql.password);
}

function assertProductionConfig(config: ExportPlatformConfig, env: ConfigEnv): void {
  if (config.environment !== "production") {
    return;
  }

  assertProductionMysqlConfig(config, env);
  assertSafeProductionEndpoint(
    "EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT",
    config.objectStorage.endpoint
  );
  assertRequiredProductionValue("EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET", config.objectStorage.bucket);
  assertSafeProductionEndpoint("EXPORT_PLATFORM_PUBLIC_BASE_URL", config.security.publicBaseUrl);
  assertRequiredProductionSecret(
    "EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET",
    config.security.downloadUrlSigningSecret
  );
  assertRequiredProductionSecret(
    "EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET",
    config.security.authContextSigningSecret
  );

  for (const [code, url] of Object.entries(config.datasource.urlsByCode)) {
    assertSafeProductionEndpoint(`EXPORT_PLATFORM_DATASOURCE(${code})`, url);
  }

  if (!config.objectStorage.allowSmokeWrites) {
    throw new Error(
      "Production object storage smoke requires EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true"
    );
  }
}

export function loadDatabaseConfig(env: ConfigEnv = process.env): DatabaseRuntimeConfig {
  const environment = readEnvironment(env.EXPORT_PLATFORM_ENVIRONMENT);
  const mysql = loadMysqlConfig(env);
  const config = {
    environment,
    databaseUrl: env.EXPORT_PLATFORM_DATABASE_URL,
    mysql
  };

  if (environment === "production") {
    assertProductionMysqlConfig(config, env);
  }

  return config;
}

export function loadConfig(env: ConfigEnv = process.env): ExportPlatformConfig {
  const environment = readEnvironment(env.EXPORT_PLATFORM_ENVIRONMENT);
  const http = {
    host: env.EXPORT_PLATFORM_HOST ?? "0.0.0.0",
    port: readInt(env.EXPORT_PLATFORM_PORT, 3000)
  };
  const mysql = loadMysqlConfig(env);
  const scheduler = {
    pollIntervalMs: readInt(env.EXPORT_PLATFORM_SCHEDULER_POLL_MS, 5000)
  };
  const cleanup = {
    pollIntervalMs: readInt(env.EXPORT_PLATFORM_CLEANUP_POLL_MS, 60000)
  };
  const config: ExportPlatformConfig = {
    serviceName: "export-platform",
    deliveryShape: "independent_microservice",
    environment,
    host: http.host,
    port: http.port,
    http,
    databaseUrl: env.EXPORT_PLATFORM_DATABASE_URL,
    mysql,
    schedulerPollIntervalMs: scheduler.pollIntervalMs,
    scheduler,
    cleanupPollIntervalMs: cleanup.pollIntervalMs,
    cleanup,
    datasource: readDatasourceConfig(env),
    objectStorage: readObjectStorageConfig(env),
    security: readSecurityConfig(env),
    worker: readWorkerConfig(env),
    securityPolicy: {
      productionFailFast: environment === "production",
      rejectUnsafeProductionEndpoints: environment === "production",
      requireExplicitSmokeWrites: environment === "production"
    }
  };

  assertProductionConfig(config, env);
  return config;
}
