import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogSnapshot } from "../../../types/catalog.js";
import {
  combineCatalogImports,
  createCatalogExport,
  createCatalogWorkExport,
  parseCatalogImport,
  selectCatalogWork,
} from "./transfer.ts";

const snapshot: CatalogSnapshot = {
  works: [
    {
      id: "work-1",
      title: "作品",
      aliases: [],
      authors: [],
      otherInfo: "",
    },
  ],
  publications: [
    {
      id: "publication-1",
      workId: "work-1",
      category: "动画",
      title: "第一季",
      subtitle: "",
      date: "2026-01-01",
      isbn: "",
    },
  ],
  episodes: [
    {
      id: "episode-1",
      publicationId: "publication-1",
      number: "01",
      title: "第一集",
      date: "2026-01-01",
    },
  ],
  completion: [{ id: "work-1", completed: true }],
};

test("createCatalogExport optionally includes completion", () => {
  const exportedAt = new Date("2026-08-22T00:00:00.000Z");
  const complete = createCatalogExport(snapshot, true, exportedAt);
  const withoutCompletion = createCatalogExport(snapshot, false, exportedAt);

  assert.equal(complete.format, "todo-list-catalog");
  assert.equal(complete.exportedAt, "2026-08-22T00:00:00.000Z");
  assert.deepEqual(complete.data.completion, snapshot.completion);
  assert.equal("completion" in withoutCompletion.data, false);
});

test("createCatalogWorkExport nests publications and episodes", () => {
  const exported = createCatalogWorkExport(
    snapshot,
    "work-1",
    new Date("2026-08-27T00:00:00.000Z"),
  );

  assert.equal(exported.format, "todo-list-catalog-work");
  assert.equal(exported.data.work.id, "work-1");
  assert.equal(exported.data.work.publications[0]?.id, "publication-1");
  assert.equal(
    exported.data.work.publications[0]?.episodes[0]?.id,
    "episode-1",
  );
  assert.deepEqual(parseCatalogImport(exported, "works"), snapshot);
});

test("parseCatalogImport reads a complete export", () => {
  const document = createCatalogExport(snapshot, true);
  const parsed = parseCatalogImport(document, "all");

  assert.deepEqual(parsed, snapshot);
});

test("parseCatalogImport generates UUIDs for a raw single-level array", () => {
  const parsed = parseCatalogImport(
    [
      {
        id: "external-id-is-ignored",
        number: "02",
        title: "第二集",
        date: "2026-01-08",
      },
    ],
    "episodes",
    snapshot,
    "publication-1",
    () => "generated-episode",
  );

  assert.deepEqual(parsed, {
    episodes: [
      {
        id: "generated-episode",
        publicationId: "publication-1",
        number: "02",
        title: "第二集",
        date: "2026-01-08",
      },
    ],
  });
});

test("parseCatalogImport generates and links UUIDs for an external tree", () => {
  const ids = ["new-work", "new-publication", "new-episode"];
  const parsed = parseCatalogImport(
    [
      {
        title: "外部作品",
        publications: [
          {
            category: "动画",
            title: "第一季",
            episodes: [{ number: "01", title: "第一集" }],
          },
        ],
      },
    ],
    "all",
    snapshot,
    undefined,
    () => ids.shift()!,
  );

  assert.equal(parsed.works?.[0]?.id, "new-work");
  assert.equal(parsed.publications?.[0]?.workId, "new-work");
  assert.equal(parsed.episodes?.[0]?.publicationId, "new-publication");
  assert.equal(parsed.episodes?.[0]?.id, "new-episode");
});

test("parseCatalogImport rejects backup IDs used by another entity store", () => {
  const document = createCatalogExport(snapshot, true);
  document.data.episodes = [
    {
      ...snapshot.episodes[0]!,
      id: "work-1",
    },
  ];

  assert.throws(
    () => parseCatalogImport(document, "episodes", snapshot),
    /已用于 works/,
  );
});

test("combineCatalogImports lets later files replace the same store ID", () => {
  const combined = combineCatalogImports([
    {
      works: [{ ...snapshot.works[0]!, title: "第一个文件" }],
      completion: [{ id: "work-1", completed: false }],
    },
    {
      works: [
        { ...snapshot.works[0]!, title: "第二个文件" },
        {
          id: "work-2",
          title: "新增作品",
          aliases: [],
          authors: [],
          otherInfo: "",
        },
      ],
      completion: [{ id: "work-1", completed: true }],
    },
  ]);

  assert.deepEqual(
    combined.works?.map(({ id, title }) => [id, title]),
    [
      ["work-1", "第二个文件"],
      ["work-2", "新增作品"],
    ],
  );
  assert.deepEqual(combined.completion, [{ id: "work-1", completed: true }]);
});

test("combineCatalogImports rejects cross-file entity ID collisions", () => {
  assert.throws(
    () =>
      combineCatalogImports([
        { works: [snapshot.works[0]!] },
        {
          episodes: [
            {
              ...snapshot.episodes[0]!,
              id: "work-1",
            },
          ],
        },
      ]),
    /同时出现在 works 和 episodes/,
  );
});

test("selectCatalogWork includes only one work and its related data", () => {
  const selected = selectCatalogWork(
    {
      works: [
        ...snapshot.works,
        {
          id: "work-2",
          title: "其他作品",
          aliases: [],
          authors: [],
          otherInfo: "",
        },
      ],
      publications: [
        ...snapshot.publications,
        {
          id: "publication-2",
          workId: "work-2",
          category: "电影",
          title: "其他出版物",
          subtitle: "",
          date: "2026-02-01",
          isbn: "",
        },
      ],
      episodes: [
        ...snapshot.episodes,
        {
          id: "episode-2",
          publicationId: "publication-2",
          number: "01",
          title: "其他集",
          date: "2026-02-01",
        },
      ],
      completion: [
        { id: "work-1", completed: true },
        { id: "publication-1", completed: false },
        { id: "episode-1", completed: true },
        { id: "work-2", completed: false },
        { id: "publication-2", completed: false },
        { id: "episode-2", completed: false },
      ],
    },
    "work-1",
  );

  assert.deepEqual(
    selected.works.map(({ id }) => id),
    ["work-1"],
  );
  assert.deepEqual(
    selected.publications.map(({ id }) => id),
    ["publication-1"],
  );
  assert.deepEqual(
    selected.episodes.map(({ id }) => id),
    ["episode-1"],
  );
  assert.deepEqual(
    selected.completion.map(({ id }) => id),
    ["work-1", "publication-1", "episode-1"],
  );
});
