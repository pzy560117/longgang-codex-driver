import { once } from "node:events";
import http from "node:http";

const options = parseArgs(process.argv.slice(2));
const bucket = options.bucket ?? process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET ?? "export-platform-local-rehearsal";
const host = options.host ?? "127.0.0.1";
const port = Number(options.port ?? 0);
const objects = new Map();

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const requestBucket = pathSegments.shift();
  const storageKey = decodeStorageKey(pathSegments);

  if (requestBucket !== bucket || !storageKey) {
    response.statusCode = 404;
    response.end("not found");
    return;
  }

  if (request.method === "PUT") {
    const copySource = request.headers["x-export-copy-source"];
    if (typeof copySource === "string") {
      const [sourceBucket, ...sourceKeySegments] = copySource.split("/");
      const sourceStorageKey = sourceKeySegments.join("/");
      if (sourceBucket !== bucket || !objects.has(sourceStorageKey)) {
        response.statusCode = 404;
        response.end("missing source object");
        return;
      }

      objects.set(storageKey, Buffer.from(objects.get(sourceStorageKey)));
      response.statusCode = 201;
      response.end("copied");
      return;
    }

    objects.set(storageKey, await readRequestBody(request));
    response.statusCode = 201;
    response.end("stored");
    return;
  }

  if (request.method === "GET") {
    const body = objects.get(storageKey);
    if (!body) {
      response.statusCode = 404;
      response.end("missing object");
      return;
    }

    response.statusCode = 200;
    response.setHeader("content-type", "application/octet-stream");
    response.end(body);
    return;
  }

  response.statusCode = 405;
  response.end("method not allowed");
});

server.listen(port, host);
await once(server, "listening");

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to resolve local object storage server address");
}

console.log(
  `LOCAL_OBJECT_STORAGE_READY ${JSON.stringify({
    endpoint: `http://${host}:${address.port}`,
    bucket
  })}`
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = args[index + 1];
    if (value && !value.startsWith("--")) {
      parsed[key] = value;
      index += 1;
    } else {
      parsed[key] = "true";
    }
  }
  return parsed;
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function decodeStorageKey(segments) {
  return segments.map((segment) => decodeURIComponent(segment)).join("/");
}
