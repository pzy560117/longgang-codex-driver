type ConfigEnv = NodeJS.ProcessEnv;

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
};

export type SchedulerConfig = {
  pollIntervalMs: number;
};

export type CleanupConfig = {
  pollIntervalMs: number;
};

export type ExportPlatformConfig = {
  serviceName: "export-platform";
  deliveryShape: "independent_microservice";
  host: string;
  port: number;
  http: HttpConfig;
  databaseUrl?: string;
  mysql: MysqlConfig;
  schedulerPollIntervalMs: number;
  scheduler: SchedulerConfig;
  cleanupPollIntervalMs: number;
  cleanup: CleanupConfig;
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
      ssl: readBoolean(url.searchParams.get("ssl") ?? undefined, false)
    };
  }

  return {
    host: env.EXPORT_PLATFORM_MYSQL_HOST ?? "127.0.0.1",
    port: readInt(env.EXPORT_PLATFORM_MYSQL_PORT, 3306),
    database: env.EXPORT_PLATFORM_MYSQL_DATABASE ?? "export_platform",
    user: env.EXPORT_PLATFORM_MYSQL_USER ?? "root",
    password: env.EXPORT_PLATFORM_MYSQL_PASSWORD ?? "",
    ssl: readBoolean(env.EXPORT_PLATFORM_MYSQL_SSL, false)
  };
}

export function loadConfig(env: ConfigEnv = process.env): ExportPlatformConfig {
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

  return {
    serviceName: "export-platform",
    deliveryShape: "independent_microservice",
    host: http.host,
    port: http.port,
    http,
    databaseUrl: env.EXPORT_PLATFORM_DATABASE_URL,
    mysql,
    schedulerPollIntervalMs: scheduler.pollIntervalMs,
    scheduler,
    cleanupPollIntervalMs: cleanup.pollIntervalMs,
    cleanup
  };
}
