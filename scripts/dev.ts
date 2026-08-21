import { readFile } from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import {
  developmentDirectory,
  renderPage,
  sourceStylePath,
} from "./build-config.ts";
import { resolveStaticFile } from "./safe-path.ts";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "8080", 10);

const assetsDirectory = path.join(developmentDirectory, "assets");

const pagePaths = new Set(["/", "/index.html", "/todo-list.html"]);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

const send = (
  request: IncomingMessage,
  response: ServerResponse,
  contentType: string,
  body: Buffer | string,
): void => {
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    "content-type": contentType,
  });
  response.end(request.method === "HEAD" ? undefined : body);
};

const sendPage = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  send(request, response, "text/html; charset=utf-8", await renderPage(true));
};

const sendAsset = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<void> => {
  const requestedPath = pathname.slice("/assets/".length);
  const filePath =
    requestedPath === "style.css"
      ? sourceStylePath
      : await resolveStaticFile(assetsDirectory, requestedPath);

  if (!filePath) {
    response.writeHead(404).end();
    return;
  }

  try {
    const body = await readFile(filePath);
    send(
      request,
      response,
      contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      body,
    );
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      response.writeHead(404).end();
      return;
    }
    throw error;
  }
};

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" }).end();
    return;
  }

  let operation: Promise<void>;
  if (pagePaths.has(pathname)) {
    operation = sendPage(request, response);
  } else if (pathname.startsWith("/assets/")) {
    operation = sendAsset(request, response, pathname);
  } else {
    response.writeHead(404).end();
    return;
  }

  void operation.catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!response.headersSent) {
      response.writeHead(500, {
        "content-type": "text/plain; charset=utf-8",
      });
    }
    response.end(`Development server error: ${message}`);
  });
});

await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, host, resolve);
});

console.log(`Development server: http://${host}:${port}`);

let shuttingDown = false;
const shutdown = (): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
