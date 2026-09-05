import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogSnapshot } from "../../../types/catalog.js";
import {
  appendCatalogRecord,
  buildCatalog,
  mergeCatalogSnapshot,
  removeCatalogRecord,
  updateCatalogRecord,
} from "./catalog.ts";

const snapshot: CatalogSnapshot = {
  works: [
    {
      id: "sao",
      title: "刀剑神域",
      aliases: ["SAO"],
      authors: ["川原砾"],
      otherInfo: "",
    },
  ],
  publications: [
    {
      id: "anime-1",
      workId: "sao",
      category: "动画",
      timelineGroup: "本篇",
      title: "第1部",
      subtitle: "",
      date: "2012-07-08",
      isbn: "",
    },
  ],
  episodes: [
    {
      id: "episode-2",
      publicationId: "anime-1",
      number: "02",
      title: "封弊者",
      date: "2012-07-15",
    },
    {
      id: "episode-1",
      publicationId: "anime-1",
      number: "01",
      title: "剑的世界",
      date: "2012-07-08",
    },
  ],
  completion: [
    { id: "sao", completed: false },
    { id: "anime-1", completed: true },
    { id: "episode-1", completed: true },
    { id: "episode-2", completed: false },
  ],
};

test("buildCatalog creates and sorts the three-level catalog", () => {
  const catalog = buildCatalog(snapshot);

  assert.equal(catalog[0]?.title, "刀剑神域");
  assert.equal(catalog[0]?.publications[0]?.title, "第1部");
  assert.equal(catalog[0]?.publications[0]?.completed, true);
  assert.equal(catalog[0]?.publications[0]?.episodes[0]?.completed, true);
  assert.deepEqual(
    catalog[0]?.publications[0]?.episodes.map(({ number }) => number),
    ["01", "02"],
  );
});

test("buildCatalog sorts within each parent without mutating the snapshot", () => {
  const data: CatalogSnapshot = {
    ...snapshot,
    publications: [
      { ...snapshot.publications[0]!, id: "anime-2", title: "第2部", date: "" },
      snapshot.publications[0]!,
    ],
    episodes: [
      {
        ...snapshot.episodes[0]!,
        id: "second-10",
        publicationId: "anime-2",
        number: "10",
      },
      ...snapshot.episodes,
      {
        ...snapshot.episodes[0]!,
        id: "second-2",
        publicationId: "anime-2",
        number: "2",
      },
      {
        ...snapshot.episodes[0]!,
        id: "second-2-earlier",
        publicationId: "anime-2",
        number: "2",
        date: "2012-01-01",
      },
    ],
  };
  const before = structuredClone(data);
  const publications = buildCatalog(data)[0]!.publications;
  assert.deepEqual(
    publications.map(({ id }) => id),
    ["anime-1", "anime-2"],
  );
  assert.deepEqual(
    publications[0]?.episodes.map(({ id }) => id),
    ["episode-1", "episode-2"],
  );
  assert.deepEqual(
    publications[1]?.episodes.map(({ id }) => id),
    ["second-2-earlier", "second-2", "second-10"],
  );
  assert.deepEqual(data, before);
});

test("appendCatalogRecord appends records and completion mappings", () => {
  const result = appendCatalogRecord(snapshot, {
    storeName: "episodes",
    dataList: [
      {
        id: "episode-3",
        publicationId: "anime-1",
        number: "03",
        title: "红鼻子驯鹿",
        date: "2012-07-22",
      },
    ],
  });

  assert.equal(result.episodes.length, 3);
  assert.equal(snapshot.episodes.length, 2);
  assert.equal(
    result.completion.find(({ id }) => id === "episode-3")?.completed,
    false,
  );
});

test("updateCatalogRecord updates completion by UUID", () => {
  const result = updateCatalogRecord(snapshot, {
    storeName: "completion",
    dataList: [{ id: "sao", completed: true }],
  });

  assert.equal(
    result.completion.find(({ id }) => id === "sao")?.completed,
    true,
  );
  assert.equal(result.completion.length, snapshot.completion.length);
});

test("updateCatalogRecord replaces an entity without changing completion", () => {
  const result = updateCatalogRecord(snapshot, {
    storeName: "works",
    dataList: [{ ...snapshot.works[0]!, title: "Sword Art Online" }],
  });

  assert.equal(result.works[0]?.title, "Sword Art Online");
  assert.deepEqual(result.completion, snapshot.completion);
});

test("removeCatalogRecord cascades through children and completion", () => {
  const result = removeCatalogRecord(snapshot, {
    storeName: "publications",
    id: "anime-1",
  });

  assert.equal(result.works.length, 1);
  assert.equal(result.publications.length, 0);
  assert.equal(result.episodes.length, 0);
  assert.deepEqual(result.completion, [{ id: "sao", completed: false }]);
});

test("mergeCatalogSnapshot upserts imports and creates missing completion", () => {
  const result = mergeCatalogSnapshot(snapshot, {
    episodes: [
      {
        id: "episode-3",
        publicationId: "anime-1",
        number: "03",
        title: "红鼻子驯鹿",
        date: "2012-07-22",
      },
    ],
    completion: [{ id: "episode-3", completed: true }],
  });

  assert.equal(result.episodes.length, 3);
  assert.equal(
    result.completion.find(({ id }) => id === "episode-3")?.completed,
    true,
  );
});
