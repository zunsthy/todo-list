import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createBridgeServer, type BridgeServer } from "./server.ts";
import { createBridgeClient } from "../../src/shared/bridge/client.ts";
import type { BridgeRpcResponse } from "../../src/shared/bridge/types.ts";
import { parseCatalogBridgeRpcRequest } from "../../src/pages/works/bridge/protocol.ts";
import { parseTravelBridgeRpcRequest } from "../../src/pages/travel/bridge/protocol.ts";
import { createTravelBridgeRouter } from "../../src/pages/travel/bridge/router.ts";
import { openTravelDatabase } from "../../src/pages/travel/db.ts";
import type { TravelSnapshot } from "../../src/pages/travel/types.ts";

test(
  "travel bridge smoke: preview, commit, conflict and non-pruning delete",
  { timeout: 10_000 },
  async (t) => {
    const database = await openTravelDatabase(
      `travel-bridge-smoke-${crypto.randomUUID()}`,
    );
    const router = createTravelBridgeRouter(database, () => {});
    let bridge: BridgeServer;
    const server = http.createServer((request, response) => {
      if (
        !bridge.handleHttp(
          request,
          response,
          new URL(request.url!, "http://localhost").pathname,
        )
      )
        response.writeHead(404).end();
    });
    bridge = createBridgeServer(server, [
      { prefix: "/__catalog", parseRequest: parseCatalogBridgeRpcRequest },
      { prefix: "/__travel", parseRequest: parseTravelBridgeRpcRequest },
    ]);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    let connected!: () => void;
    const ready = new Promise<void>((resolve) => {
      connected = resolve;
    });
    const client = createBridgeClient({
      parseRequest: parseTravelBridgeRpcRequest,
      route: router.route,
      onStatus: (status) => {
        if (status === "connected") connected();
      },
    });
    t.after(async () => {
      client.disconnect();
      router.close();
      database.close();
      bridge.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
    client.connect(`${base.replace("http", "ws")}/__travel/ws`, "smoke-page");
    await ready;
    const pages = (await (await fetch(`${base}/__travel/pages`)).json()) as {
      pages: { pageId: string }[];
    };
    assert.equal(pages.pages[0]?.pageId, "smoke-page");
    assert.deepEqual(await (await fetch(`${base}/__catalog/pages`)).json(), {
      pages: [],
    });
    const call = async (method: string, params: object = {}) =>
      fetch(`${base}/__travel/pages/smoke-page/rpc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: crypto.randomUUID(), method, params }),
      });
    const rpc = async <T = unknown>(
      method: string,
      params: object = {},
    ): Promise<T> => {
      const result = (await (
        await call(method, params)
      ).json()) as BridgeRpcResponse;
      assert.equal(result.ok, true, JSON.stringify(result));
      assert(result.ok);
      return result.result as T;
    };
    assert.equal((await call("catalog.snapshot")).status, 400);
    const preview = await rpc<{ previewId: string }>(
      "travel.mutations.preview",
      {
        operations: [
          {
            action: "region.create",
            data: {
              id: "110000",
              parentId: "CN",
              name: "北京市",
              kind: "直辖市",
            },
          },
          {
            action: "region.create",
            data: {
              id: "110114",
              parentId: "110000",
              name: "昌平区",
              kind: "区",
            },
          },
          {
            action: "footprint.create",
            data: {
              regionId: "110114",
              name: "徒步",
              time: "2026-09",
              visitType: "户外",
            },
          },
        ],
      },
    );
    assert.equal(
      (await rpc<TravelSnapshot>("travel.snapshot")).regions.length,
      1,
    );
    const result = await rpc("travel.mutations.commit", preview);
    assert.deepEqual(await rpc("travel.mutations.commit", preview), result);
    const snapshot = await rpc<TravelSnapshot>("travel.snapshot");
    assert.equal(snapshot.regions.length, 3);
    assert.equal(snapshot.footprints.length, 1);
    const footprint = snapshot.footprints[0]!;
    assert.equal(footprint.pos, null);
    const stale = await rpc("travel.mutations.preview", {
      operations: [
        {
          action: "footprint.update",
          id: footprint.id,
          changes: { notes: "远程修改" },
        },
      ],
    });
    await database.saveFootprint(
      { ...footprint, notes: "本地修改" },
      footprint,
    );
    const conflict = (await (
      await call("travel.mutations.commit", stale as object)
    ).json()) as BridgeRpcResponse;
    assert(!conflict.ok);
    assert.equal(conflict.error.code, "CONFLICT");
    const deletion = await rpc<{ previewId: string }>(
      "travel.mutations.preview",
      { operations: [{ action: "footprint.delete", id: footprint.id }] },
    );
    await rpc("travel.mutations.commit", deletion);
    const final = await rpc<TravelSnapshot>("travel.snapshot");
    assert.equal(final.footprints.length, 0);
    assert.deepEqual(final.regions, snapshot.regions);
  },
);
