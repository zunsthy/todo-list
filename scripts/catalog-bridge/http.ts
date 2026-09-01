import type { IncomingMessage, ServerResponse } from "node:http";
import { CatalogBridgeBroker, CatalogBridgeBrokerError } from "./broker.ts";
import {
  parseCatalogBridgeRpcRequest,
  parseJsonMessage,
} from "../../src/todo-list/bridge/protocol.ts";

const maxBodyBytes = 5 * 1024 * 1024;

const sendJson = (
  response: ServerResponse,
  status: number,
  value: unknown,
): void => {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(body);
};

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) {
      throw new CatalogBridgeBrokerError(
        "BODY_TOO_LARGE",
        `请求体不能超过 ${maxBodyBytes} 字节`,
        413,
      );
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  broker: CatalogBridgeBroker,
): Promise<void> => {
  if (pathname === "/__catalog/pages") {
    if (request.method !== "GET") {
      response.writeHead(405, { allow: "GET" }).end();
      return;
    }
    sendJson(response, 200, { pages: broker.list() });
    return;
  }

  const match = pathname.match(/^\/__catalog\/pages\/([^/]+)\/rpc$/);
  if (!match) {
    response.writeHead(404).end();
    return;
  }
  if (request.method !== "POST") {
    response.writeHead(405, { allow: "POST" }).end();
    return;
  }

  const pageId = decodeURIComponent(match[1]!);
  const rpc = parseCatalogBridgeRpcRequest(
    parseJsonMessage(await readBody(request)),
  );
  sendJson(response, 200, await broker.request(pageId, rpc));
};

export const handleCatalogBridgeHttp = (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  broker: CatalogBridgeBroker,
): boolean => {
  if (!pathname.startsWith("/__catalog/")) return false;
  void handleRequest(request, response, pathname, broker).catch(
    (error: unknown) => {
      const known =
        error instanceof CatalogBridgeBrokerError
          ? error
          : new CatalogBridgeBrokerError(
              "INVALID_REQUEST",
              error instanceof Error ? error.message : String(error),
              400,
            );
      if (!response.headersSent) {
        sendJson(response, known.status, {
          ok: false,
          error: { code: known.code, message: known.message },
        });
      } else {
        response.end();
      }
    },
  );
  return true;
};
