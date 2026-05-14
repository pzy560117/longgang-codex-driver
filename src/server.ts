import Fastify, { type FastifyInstance } from "fastify";
import { fileURLToPath } from "node:url";
import { loadConfig, type ExportPlatformConfig } from "./config/env.ts";
import { registerRoutes } from "./routes/register-routes.ts";

export function createExportPlatformServer(
  config: ExportPlatformConfig = loadConfig()
): FastifyInstance {
  const app = Fastify({
    logger: false
  });

  app.get("/health", async () => ({
    status: "ok",
    service: config.serviceName,
    deliveryShape: config.deliveryShape,
    entries: {
      http: true,
      worker: true,
      cleanupJob: true
    }
  }));

  registerRoutes(app);

  app.setNotFoundHandler(async (_request, response) => {
    response.code(404).send({
      code: "TASK_NOT_FOUND",
      message: "route not found",
      data: null
    });
  });

  return app;
}

export async function startServer(
  config: ExportPlatformConfig = loadConfig()
): Promise<FastifyInstance> {
  const server = createExportPlatformServer(config);
  await server.listen({ port: config.port, host: config.host });
  console.log(
    JSON.stringify({
      event: "export-platform.http.started",
      host: config.host,
      port: config.port
    })
  );
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
