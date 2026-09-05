import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import type { CatalogBridgeRpcRequest } from "../../types/catalog-bridge.ts";
import type { CatalogSnapshot } from "../../types/catalog.ts";
import * as database from "../db/index.ts";
import { routeCatalogBridgeRequest } from "./router.ts";

const workId = "00000000-0000-4000-8000-000000000001";
const publicationId = "00000000-0000-4000-8000-000000000002";
const episodeId = "00000000-0000-4000-8000-000000000003";

const invoke = (request: Omit<CatalogBridgeRpcRequest, "type" | "id">) =>
  routeCatalogBridgeRequest(
    {
      ...request,
      type: "request",
      id: crypto.randomUUID(),
    } as CatalogBridgeRpcRequest,
    () => {},
  );

const snapshot = () =>
  invoke({
    method: "catalog.snapshot",
    params: {},
  }) as Promise<CatalogSnapshot>;

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  await new Promise<void>((resolve, reject) => {
    database.open((error) => (error ? reject(error) : resolve()));
  });
  await invoke({
    method: "catalog.entity.create",
    params: { storeName: "works", data: { id: workId, title: "作品" } },
  });
});

afterEach(() => database.close());

test("bridge concurrent updates preserve both changes", async () => {
  await Promise.all([
    invoke({
      method: "catalog.entity.update",
      params: { storeName: "works", id: workId, changes: { title: "新标题" } },
    }),
    invoke({
      method: "catalog.entity.update",
      params: {
        storeName: "works",
        id: workId,
        changes: { otherInfo: "新备注" },
      },
    }),
  ]);
  const result = await snapshot();
  assert.equal(result.works[0]?.title, "新标题");
  assert.equal(result.works[0]?.otherInfo, "新备注");
});

test("bridge concurrent dependent creates see committed parents", async () => {
  await Promise.all([
    invoke({
      method: "catalog.entity.create",
      params: {
        storeName: "publications",
        data: { id: publicationId, workId, category: "动画", title: "第一季" },
      },
    }),
    invoke({
      method: "catalog.entity.create",
      params: {
        storeName: "episodes",
        data: { id: episodeId, publicationId, number: "01", title: "第一集" },
      },
    }),
  ]);
  const result = await snapshot();
  assert.equal(result.publications.length, 1);
  assert.equal(result.episodes[0]?.publicationId, publicationId);
  assert.equal(result.completion.length, 3);
});

test("bridge validation failure rolls back the entire batch", async () => {
  const before = await snapshot();
  let changed = false;
  await assert.rejects(
    routeCatalogBridgeRequest(
      {
        type: "request",
        id: "invalid-batch",
        method: "catalog.batch",
        params: {
          operations: [
            {
              action: "update",
              storeName: "works",
              id: workId,
              changes: { title: "不应保存" },
            },
            {
              action: "create",
              storeName: "episodes",
              data: { publicationId, number: "01", title: "孤立集" },
            },
          ],
        },
      },
      () => {
        changed = true;
      },
    ),
    /找不到所属出版物/,
  );
  assert.equal(changed, false);
  assert.deepEqual(await snapshot(), before);
});

test("bridge completion writes leave unrelated records untouched", async (t) => {
  const put = t.mock.method(IDBObjectStore.prototype, "put");
  const clear = t.mock.method(IDBObjectStore.prototype, "clear");
  await invoke({
    method: "catalog.completion.set",
    params: { id: workId, completed: true },
  });
  assert.equal(clear.mock.callCount(), 0);
  assert.equal(put.mock.callCount(), 1);
  const store = put.mock.calls[0]?.this;
  assert(store instanceof IDBObjectStore);
  assert.equal(store.name, "completion");
  assert.deepEqual((await snapshot()).completion, [
    { id: workId, completed: true },
  ]);
});

test("bridge deletion commits children and completion together", async () => {
  await invoke({
    method: "catalog.batch",
    params: {
      operations: [
        {
          action: "create",
          storeName: "publications",
          data: {
            id: publicationId,
            workId,
            category: "动画",
            title: "第一季",
          },
        },
        {
          action: "create",
          storeName: "episodes",
          data: { id: episodeId, publicationId, number: "01", title: "第一集" },
        },
      ],
    },
  });
  await invoke({
    method: "catalog.entity.delete",
    params: { storeName: "works", id: workId },
  });
  assert.deepEqual(await snapshot(), {
    works: [],
    publications: [],
    episodes: [],
    completion: [],
  });
});

test("bridge storage failure rolls back already queued writes", async (t) => {
  const before = await snapshot();
  const originalPut = IDBObjectStore.prototype.put;
  t.mock.method(
    IDBObjectStore.prototype,
    "put",
    function (this: IDBObjectStore, value: unknown) {
      if (this.name === "completion")
        throw new DOMException("Storage full", "QuotaExceededError");
      return originalPut.call(this, value);
    },
  );
  await assert.rejects(
    invoke({
      method: "catalog.batch",
      params: {
        operations: [
          {
            action: "update",
            storeName: "works",
            id: workId,
            changes: { title: "不应保存" },
          },
          { action: "setCompletion", id: workId, completed: true },
        ],
      },
    }),
    { name: "QuotaExceededError" },
  );
  assert.deepEqual(await snapshot(), before);
});
