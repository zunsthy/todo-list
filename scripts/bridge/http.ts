import type { IncomingMessage, ServerResponse } from "node:http";
import { BridgeBroker, BridgeBrokerError } from "./broker.ts";
import { parseJsonMessage } from "../../src/shared/bridge/protocol.ts";
import type { BridgeRpcRequest } from "../../src/shared/bridge/types.ts";
import { isLocalBridgeRequest } from "./local-request.ts";

export interface BridgeModule {
  prefix: string;
  parseRequest(value: unknown): BridgeRpcRequest;
}

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
      throw new BridgeBrokerError(
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
  broker: BridgeBroker,
  module: BridgeModule,
): Promise<void> => {
  if (!isLocalBridgeRequest(request)) {
    throw new BridgeBrokerError("FORBIDDEN", "数据桥只允许本机同源访问", 403);
  }
  if (pathname === `${module.prefix}/pages`) {
    if (request.method !== "GET") {
      response.writeHead(405, { allow: "GET" }).end();
      return;
    }
    sendJson(response, 200, { pages: broker.list() });
    return;
  }

  const match = pathname
    .slice(module.prefix.length)
    .match(/^\/pages\/([^/]+)\/rpc$/);
  if (!match) {
    response.writeHead(404).end();
    return;
  }
  if (request.method !== "POST") {
    response.writeHead(405, { allow: "POST" }).end();
    return;
  }

  const pageId = decodeURIComponent(match[1]!);
  const rpc = module.parseRequest(parseJsonMessage(await readBody(request)));
  sendJson(response, 200, await broker.request(pageId, rpc));
};

export const handleBridgeHttp = (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  broker: BridgeBroker,
  module: BridgeModule,
): boolean => {
  if (!pathname.startsWith(`${module.prefix}/`)) return false;
  void handleRequest(request, response, pathname, broker, module).catch(
    (error: unknown) => {
      const known =
        error instanceof BridgeBrokerError
          ? error
          : new BridgeBrokerError(
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
