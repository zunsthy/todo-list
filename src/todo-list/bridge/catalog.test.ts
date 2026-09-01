import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogSnapshot } from "../../types/catalog.js";
import { applyCatalogBridgeOperations } from "./catalog.ts";

const ids = {
  work: "00000000-0000-4000-8000-000000000001",
  publication: "00000000-0000-4000-8000-000000000002",
  episode: "00000000-0000-4000-8000-000000000003",
  newPublication: "00000000-0000-4000-8000-000000000004",
};

const snapshot = (): CatalogSnapshot => ({
  works: [
    {
      id: ids.work,
      title: "作品",
      aliases: [],
      authors: ["作者"],
      otherInfo: "",
    },
  ],
  publications: [
    {
      id: ids.publication,
      workId: ids.work,
      category: "动画",
      title: "第一季",
      subtitle: "",
      date: "2026-01-01",
      isbn: "",
    },
  ],
  episodes: [
    {
      id: ids.episode,
      publicationId: ids.publication,
      number: "01",
      title: "开始",
      date: "2026-01-01",
    },
  ],
  completion: [
    { id: ids.work, completed: false },
    { id: ids.publication, completed: false },
    { id: ids.episode, completed: true },
  ],
});

test("bridge batch creates, updates, and preserves completion", () => {
  const result = applyCatalogBridgeOperations(snapshot(), [
    {
      action: "create",
      storeName: "publications",
      data: {
        id: ids.newPublication,
        workId: ids.work,
        category: "小说",
        title: "作品 1",
      },
    },
    {
      action: "update",
      storeName: "works",
      id: ids.work,
      changes: { otherInfo: "已更新" },
    },
    {
      action: "setCompletion",
      id: ids.newPublication,
      completed: true,
    },
  ]);

  assert.equal(result.snapshot.works[0]?.otherInfo, "已更新");
  assert.equal(result.snapshot.publications.length, 2);
  assert.deepEqual(
    result.snapshot.completion.find(({ id }) => id === ids.episode),
    { id: ids.episode, completed: true },
  );
  assert.deepEqual(
    result.snapshot.completion.find(({ id }) => id === ids.newPublication),
    { id: ids.newPublication, completed: true },
  );
  assert.deepEqual(
    result.results.map(({ action }) => action),
    ["create", "update", "setCompletion"],
  );
});

test("bridge delete cascades through children and completion", () => {
  const result = applyCatalogBridgeOperations(snapshot(), [
    { action: "delete", storeName: "works", id: ids.work },
  ]);

  assert.deepEqual(result.snapshot, {
    works: [],
    publications: [],
    episodes: [],
    completion: [],
  });
  assert.deepEqual(result.results, [
    { action: "delete", storeName: "works", id: ids.work },
  ]);
});

test("bridge rejects an orphaned parent without changing the source snapshot", () => {
  const source = snapshot();
  assert.throws(
    () =>
      applyCatalogBridgeOperations(source, [
        {
          action: "update",
          storeName: "publications",
          id: ids.publication,
          changes: { workId: "00000000-0000-4000-8000-000000000099" },
        },
      ]),
    /找不到所属作品/,
  );
  assert.equal(source.publications[0]?.workId, ids.work);
});
