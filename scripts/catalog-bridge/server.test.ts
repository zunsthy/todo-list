import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import WebSocket from "ws";
import {
  createCatalogBridgeServer,
  type CatalogBridgeServer,
} from "./server.ts";

const waitForOpen = (socket: WebSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

const waitForMessage = (socket: WebSocket): Promise<unknown> =>
  new Promise((resolve, reject) => {
    socket.once("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()) as unknown);
      } catch (error: unknown) {
        reject(error);
      }
    });
    socket.once("error", reject);
  });

test("catalog bridge brokers RPC requests to a registered page", async (t) => {
  let bridge: CatalogBridgeServer | null = null;
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (bridge?.handleHttp(request, response, pathname)) return;
    response.writeHead(404).end();
  });
  bridge = createCatalogBridgeServer(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const pageId = "00000000-0000-4000-8000-000000000001";
  const socket = new WebSocket(`${baseUrl.replace("http", "ws")}/__catalog/ws`);
  t.after(async () => {
    socket.close();
    bridge?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  await waitForOpen(socket);
  const readyMessage = waitForMessage(socket);
  socket.send(JSON.stringify({ type: "register", protocol: 1, pageId }));
  assert.deepEqual(await readyMessage, { type: "ready", protocol: 1, pageId });

  const pagesResponse = await fetch(`${baseUrl}/__catalog/pages`);
  assert.equal(pagesResponse.status, 200);
  const pages = (await pagesResponse.json()) as {
    pages: { pageId: string }[];
  };
  assert.equal(pages.pages[0]?.pageId, pageId);

  const pageRequest = waitForMessage(socket);
  const rpcResponse = fetch(`${baseUrl}/__catalog/pages/${pageId}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: "request-1",
      method: "catalog.snapshot",
      params: {},
    }),
  });
  assert.deepEqual(await pageRequest, {
    type: "request",
    id: "request-1",
    method: "catalog.snapshot",
    params: {},
  });
  socket.send(
    JSON.stringify({
      type: "response",
      id: "request-1",
      ok: true,
      result: { works: [] },
    }),
  );
  const response = await rpcResponse;
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    type: "response",
    id: "request-1",
    ok: true,
    result: { works: [] },
  });
});
