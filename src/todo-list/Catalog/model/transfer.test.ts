import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogSnapshot } from "../../../types/catalog.js";
import { createCatalogExport, parseCatalogImport } from "./transfer.ts";

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
