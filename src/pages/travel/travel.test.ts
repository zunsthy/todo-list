import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { openTravelDatabase } from "./db.ts";
import type { TravelDatabase } from "./db.ts";
import { buildRegionTreeView } from "./components/tree-view.ts";
import {
  buildTree,
  chinaRegion,
  filterFootprints,
  parseBackup,
  parseBoundary,
  parseFootprint,
  parsePos,
  parseTime,
  planImport,
  validateSnapshot,
} from "./model.ts";
import type {
  Footprint,
  Pos,
  Region,
  RegionBoundary,
  TravelData,
} from "./types.ts";

globalThis.indexedDB = new IDBFactory();
const now = "2026-09-05T08:00:00.000Z";
const pos: Pos = { coordinates: [116.2, 40.2], coordinateSystem: "WGS84" };
const boundary: RegionBoundary = {
  key: "110114:default",
  coordinateSystem: "GCJ02",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  },
};
const region = (id: string, parentId: string | null, name = id): Region => ({
  ...chinaRegion(),
  id,
  parentId,
  name,
  kind: parentId === null ? "国家" : "区",
});
const footprint = (regionId: string, id = "footprint-1"): Footprint => ({
  id,
  regionId,
  name: "一次到访",
  time: "2026-09",
  visitType: "旅游",
  notes: "",
  pos: null,
});
const seed = (): TravelData => ({
  regions: [chinaRegion()],
  footprints: [],
  regionBoundaries: [],
});
const children = (parentId: string, ids: string[], coverage = "complete") => ({
  format: "todo-list-region-children",
  version: 1,
  parentId,
  coverage,
  children: ids.map((id) => ({ id, name: id, kind: "区", pos: null })),
});
const database = async (
  t: TestContext,
  name = `travel-test-${crypto.randomUUID()}`,
): Promise<TravelDatabase> => {
  const handle = await openTravelDatabase(name);
  t.after(() => handle.close());
  return handle;
};
const importChildren = async (
  db: TravelDatabase,
  parentId: string,
  ids: string[],
  coverage = "complete",
) => {
  await db.import(
    await db.previewImport(children(parentId, ids, coverage), parentId),
  );
};

test("positions require coordinates and coordinate system together", () => {
  assert.equal(parsePos(null), null);
  for (const coordinateSystem of ["WGS84", "GCJ02", "BD09LL"])
    assert.deepEqual(parsePos({ coordinates: [0, 0], coordinateSystem }), {
      coordinates: [0, 0],
      coordinateSystem,
    });
  for (const value of [
    undefined,
    [116, 40],
    {},
    { coordinates: [116, 40] },
    { coordinateSystem: "WGS84" },
    { ...pos, coordinateSystem: null },
    { ...pos, coordinateSystem: "unknown" },
    { ...pos, coordinates: null },
    { ...pos, coordinates: [181, 0] },
    { ...pos, coordinates: [0, -91] },
    { ...pos, coordinates: [NaN, 0] },
    { ...pos, coordinates: [Infinity, 0] },
    { ...pos, coordinates: [1, 2, 3] },
    { ...pos, crs: "WGS84" },
  ])
    assert.throws(() => parsePos(value));
});
test("single dates preserve precision and validate the calendar", () => {
  for (const value of [null, "2026", "2026-09", "2024-02-29", "2000-02-29"])
    assert.equal(parseTime(value), value);
  for (const value of [
    "",
    "0000",
    "2026-13",
    "2026-00",
    "2026-02-29",
    "1900-02-29",
    "2026-04-31",
    "2026-09-00",
    "2026-9",
    "2026-09-05T00:00:00Z",
    { start: "2026" },
  ])
    assert.throws(() => parseTime(value));
});
test("footprints have seven fields and a single literal visit type", () => {
  const value = parseFootprint(footprint("CN"));
  assert.deepEqual(Object.keys(value).sort(), [
    "id",
    "name",
    "notes",
    "pos",
    "regionId",
    "time",
    "visitType",
  ]);
  for (const changes of [
    { visitType: ["旅游", "户外"] },
    { visitType: "未定义" },
    { updatedAt: now },
    { name: " " },
    { pos: [0, 0] },
  ])
    assert.throws(() => parseFootprint({ ...value, ...changes }));
});
test("boundaries require a coordinate system and valid polygon rings", () => {
  assert.deepEqual(parseBoundary(boundary), boundary);
  assert.equal(
    parseBoundary({
      ...boundary,
      geometry: {
        type: "MultiPolygon",
        coordinates: [boundary.geometry.coordinates],
      },
    }).geometry.type,
    "MultiPolygon",
  );
  assert.throws(() =>
    parseBoundary({ key: "missing-system", geometry: boundary.geometry }),
  );
  assert.throws(() =>
    parseBoundary({
      ...boundary,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [2, 2],
          ],
        ],
      },
    }),
  );
  assert.throws(() =>
    parseBoundary({
      ...boundary,
      geometry: { type: "MultiPolygon", coordinates: [] },
    }),
  );
});
test("region trees use explicit parents across countries and arbitrary levels", () => {
  const data: TravelData = {
    regions: [
      { ...chinaRegion(), state: "partial" },
      { ...region("110000", "CN", "北京"), state: "partial" },
      region("110114", "110000", "昌平"),
      { ...region("510000", "CN"), state: "partial" },
      { ...region("510100", "510000"), state: "partial" },
      { ...region("510156", "510100"), classification: "functional" },
      { ...region("MM", null), state: "partial" },
      { ...region("MM-17", "MM"), state: "partial" },
      region("MM-1506", "MM-17"),
      region("MM-1505", "MM-17"),
    ],
    footprints: [],
    regionBoundaries: [],
  };
  validateSnapshot(data, new Set());
  assert.deepEqual(
    buildTree(data)
      .path("MM-1506")
      .map((region) => region.id),
    ["MM", "MM-17", "MM-1506"],
  );
  assert.equal(buildTree(data).path("510156").length, 4);
  assert.equal(buildTree(data).path("110114").length, 3);
});
test("backups reject invalid identity, cycles, references and duplicate IDs", () => {
  const invalid: TravelData[] = [
    { ...seed(), regions: [region("not-a-country", null)] },
    {
      ...seed(),
      regions: [
        { ...chinaRegion(), state: "partial" },
        region(crypto.randomUUID(), "CN"),
      ],
    },
    {
      ...seed(),
      regions: [
        { ...chinaRegion(), state: "partial" },
        region("CN-110000", "CN"),
      ],
    },
    {
      ...seed(),
      regions: [region("110000", "110114"), region("110114", "110000")],
    },
    { ...seed(), regions: [region("110114", "110000")] },
    { ...seed(), regions: [chinaRegion(), region("110000", "CN")] },
    { ...seed(), footprints: [footprint("missing")] },
    { ...seed(), footprints: [footprint("CN"), footprint("CN")] },
    { ...seed(), regions: [{ ...chinaRegion(), boundaryKey: "missing" }] },
    { ...seed(), regions: [chinaRegion(), chinaRegion()] },
    { ...seed(), regionBoundaries: [boundary, boundary] },
  ];
  for (const data of invalid)
    assert.throws(() =>
      parseBackup({
        format: "todo-list-footprints",
        version: 1,
        exportedAt: now,
        data,
      }),
    );
});
test("direct-child imports reject nested descendants and incomplete coordinate data", () => {
  const valid = children("CN", ["110000"]);
  const parentWithChild = planImport(seed(), valid, "CN", now).data;
  for (const value of [
    children("MM", ["MM-17"]),
    children("CN", ["110000", "110000"]),
    { ...valid, children: [{ ...valid.children[0], children: [] }] },
    { ...valid, children: [{ id: "110000", name: "北京", kind: "市" }] },
    {
      ...valid,
      children: [{ ...valid.children[0], pos: { coordinates: [0, 0] } }],
    },
    { ...valid, children: [{ ...valid.children[0], externalRef: {} }] },
  ])
    assert.throws(() => planImport(parentWithChild, value, "CN", now));
});
test("first open seeds only China and isolates the travel database", async (t) => {
  const db = await database(t);
  assert.deepEqual((await db.export()).data, seed());
  assert.deepEqual(Object.keys(await db.snapshot()).sort(), [
    "footprints",
    "regions",
  ]);
});
test("manual child creation sets partial state without creating descendants", async (t) => {
  const db = await database(t);
  await db.saveRegion(region("110000", "CN"), null);
  const data = await db.snapshot();
  assert.equal(data.regions.length, 2);
  assert.equal(
    data.regions.find((region) => region.id === "CN")?.state,
    "partial",
  );
  assert.equal(
    data.regions.find((region) => region.id === "CN")?.importedAt,
    undefined,
  );
});
test("footprints can be created and moved to countries and non-leaf regions", async (t) => {
  const db = await database(t),
    original = footprint("CN");
  await db.saveFootprint(original, null);
  await importChildren(db, "CN", ["110000", "630000"]);
  await importChildren(db, "110000", ["110114"]);
  assert.deepEqual((await db.snapshot()).footprints, [original]);
  const edited = { ...original, notes: "依然保留在中国" };
  await db.saveFootprint(edited, original);
  await db.saveFootprint(footprint("CN", "new-country"), null);
  await db.saveFootprint(footprint("110000", "new-parent"), null);
  const moved = { ...edited, regionId: "110000" };
  await db.saveFootprint(moved, edited);
  assert.deepEqual(
    (await db.snapshot()).footprints.find((item) => item.id === original.id),
    moved,
  );
  assert.equal((await db.snapshot()).footprints.length, 3);
  assert.equal(
    (await db.snapshot()).regions.filter(
      (region) => region.parentId === "630000",
    ).length,
    0,
  );
});
test("repeated imports preserve descendant metadata and footprint references", async (t) => {
  const db = await database(t);
  await importChildren(db, "CN", ["530000", "630000"]);
  await importChildren(db, "530000", ["530100", "532300"]);
  await importChildren(db, "530100", ["530102"]);
  await db.saveFootprint(footprint("530102"), null);
  const before = await db.snapshot();
  await importChildren(db, "CN", ["530000", "630000"]);
  const after = await db.snapshot();
  assert.deepEqual(
    after.regions.filter((region) => region.id !== "CN"),
    before.regions.filter((region) => region.id !== "CN"),
  );
  assert.deepEqual(after.footprints, before.footprints);
  assert.equal(
    after.regions.some((region) => region.parentId === "532300"),
    false,
  );
});
test("deleting the last footprint preserves all regions, import metadata and boundaries", async (t) => {
  const db = await database(t);
  await importChildren(db, "CN", ["110000"]);
  const source = {
    ...children("110000", ["110114"]),
    children: [
      {
        id: "110114",
        name: "昌平",
        kind: "区",
        pos,
        boundaryKey: boundary.key,
      },
    ],
    boundaries: [boundary],
  };
  await db.import(await db.previewImport(source, "110000"));
  const record = { ...footprint("110114"), pos };
  await db.saveFootprint(record, null);
  const before = (await db.export()).data;
  await db.deleteFootprint(record);
  const after = (await db.export()).data;
  assert.deepEqual(after.regions, before.regions);
  assert.deepEqual(after.regionBoundaries, before.regionBoundaries);
  assert.deepEqual(after.footprints, []);
  assert.deepEqual(await db.getBoundary(boundary.key), boundary);
});
test("omitted local children are never deleted or falsely marked complete", async (t) => {
  const db = await database(t);
  await importChildren(db, "CN", ["110000", "530000"]);
  await importChildren(db, "530000", ["530100"]);
  const preview = await db.previewImport(children("CN", ["110000"]), "CN");
  assert.equal(preview.plan.warnings.length, 1);
  await db.import(preview);
  const result = await db.snapshot();
  assert.equal(result.regions.length, 4);
  assert.equal(
    result.regions.find((region) => region.id === "CN")?.state,
    "partial",
  );
});
test("failed imports are atomic and reject conflicting boundary contents", async (t) => {
  const db = await database(t);
  await importChildren(db, "CN", ["110000"]);
  const before = (await db.export()).data;
  await assert.rejects(
    db.previewImport(
      {
        ...children("110000", ["110114"]),
        children: [
          {
            id: "110114",
            name: "昌平",
            kind: "区",
            pos: null,
            boundaryKey: "missing",
          },
        ],
      },
      "110000",
    ),
    /边界不存在/,
  );
  assert.deepEqual((await db.export()).data, before);
  const valid = {
    ...children("110000", ["110114"]),
    children: [
      {
        id: "110114",
        name: "昌平",
        kind: "区",
        pos: null,
        boundaryKey: boundary.key,
      },
    ],
    boundaries: [boundary],
  };
  await db.import(await db.previewImport(valid, "110000"));
  await assert.rejects(
    db.previewImport(
      { ...valid, boundaries: [{ ...boundary, coordinateSystem: "WGS84" }] },
      "110000",
    ),
    /边界 key 内容冲突/,
  );
});
test("import commit revalidates its source and detects changes since preview", async (t) => {
  const db = await database(t),
    preview = await db.previewImport(children("CN", ["110000"]), "CN");
  await db.saveFootprint(footprint("CN"), null);
  await assert.rejects(db.import(preview), /重新预览/);
  assert.equal((await db.snapshot()).regions.length, 1);
  const second = await db.previewImport(children("CN", ["110000"]), "CN");
  second.source = children("MM", ["MM-17"]);
  await assert.rejects(db.import(second), /清单父级/);
  assert.equal((await db.snapshot()).regions.length, 1);
});
test("stale editors cannot overwrite or delete newer records", async (t) => {
  const db = await database(t),
    original = footprint("CN");
  await db.saveFootprint(original, null);
  await db.saveFootprint({ ...original, notes: "新内容" }, original);
  await assert.rejects(
    db.saveFootprint({ ...original, name: "旧表单" }, original),
    /已被其他操作修改/,
  );
  await assert.rejects(db.deleteFootprint(original), /已被其他操作修改/);
  const country = (await db.snapshot()).regions[0]!;
  await importChildren(db, "CN", ["110000"]);
  await assert.rejects(
    db.saveRegion({ ...country, name: "旧表单" }, country),
    /已被其他操作修改/,
  );
});
test("footprint creation still succeeds when a region gains children concurrently", async (t) => {
  const db = await database(t),
    preview = await db.previewImport(children("CN", ["110000"]), "CN");
  const results = await Promise.allSettled([
    db.import(preview),
    db.saveFootprint(footprint("CN"), null),
  ]);
  assert.equal(results[0]?.status, "fulfilled");
  assert.equal(results[1]?.status, "fulfilled");
  assert.deepEqual((await db.snapshot()).footprints, [footprint("CN")]);
  assert.equal((await db.snapshot()).regions.length, 2);
});
test("regions with children or footprints cannot be deleted", async (t) => {
  const db = await database(t);
  await db.saveFootprint(footprint("CN"), null);
  await assert.rejects(
    db.deleteRegion((await db.snapshot()).regions[0]!),
    /不能删除/,
  );
  await db.deleteFootprint(footprint("CN"));
  await importChildren(db, "CN", ["110000"]);
  await assert.rejects(
    db.deleteRegion(
      (await db.snapshot()).regions.find((region) => region.id === "CN")!,
    ),
    /不能删除/,
  );
  await db.deleteRegion(
    (await db.snapshot()).regions.find((region) => region.id === "110000")!,
  );
  assert.equal((await db.snapshot()).regions[0]?.state, "partial");
});
test("reopening an empty database does not restore a deleted seed country", async (t) => {
  const name = `travel-test-${crypto.randomUUID()}`,
    db = await database(t, name);
  await db.deleteRegion((await db.snapshot()).regions[0]!);
  db.close();
  const reopened = await database(t, name);
  assert.deepEqual((await reopened.snapshot()).regions, []);
});
test("branch backups include ancestors without mutating the original tree", async (t) => {
  const db = await database(t);
  await importChildren(db, "CN", ["110000", "530000"]);
  await importChildren(db, "110000", ["110114", "110101"]);
  await db.saveFootprint(footprint("110114"), null);
  const before = (await db.export()).data;
  const exported = await db.export("110114");
  assert.deepEqual(exported.data.regions.map((region) => region.id).sort(), [
    "110000",
    "110114",
    "CN",
  ]);
  assert.equal(
    exported.data.regions.find((region) => region.id === "CN")?.state,
    "partial",
  );
  assert.equal(
    exported.data.regions.find((region) => region.id === "110000")?.state,
    "partial",
  );
  parseBackup(exported);
  assert.deepEqual((await db.export()).data, before);
  await db.import(await db.previewImport(exported, null));
  assert.deepEqual((await db.export()).data, before);
});
test("backup restore allows historical non-leaf footprints and rejects silent moves", async (t) => {
  const db = await database(t);
  const old = footprint("CN");
  await db.saveFootprint(old, null);
  await importChildren(db, "CN", ["110000"]);
  const backup = await db.export();
  const restored = await database(t);
  await restored.import(await restored.previewImport(backup, null));
  assert.deepEqual((await restored.snapshot()).footprints, [old]);
  const changed = structuredClone(backup);
  changed.data.regions.push({ ...region("MM", null), state: "partial" });
  changed.data.regions.find((region) => region.id === "110000")!.parentId =
    "MM";
  await assert.rejects(restored.previewImport(changed, null));
});
test("routine reads and footprint edits never load boundary geometry", async (t) => {
  const db = await database(t),
    readStores: string[] = [];
  const original = IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.getAll = function (
    ...args: Parameters<typeof original>
  ) {
    readStores.push(this.name);
    return original.apply(this, args);
  };
  try {
    await db.snapshot();
    await db.saveFootprint(footprint("CN"), null);
    await db.deleteFootprint(footprint("CN"));
    assert.equal(readStores.includes("regionBoundaries"), false);
  } finally {
    IDBObjectStore.prototype.getAll = original;
  }
});

test("storage failure rolls back writes already queued during an import", async (t) => {
  const db = await database(t),
    before = (await db.export()).data;
  const preview = await db.previewImport(
    children("CN", ["110000", "530000"]),
    "CN",
  );
  const original = IDBObjectStore.prototype.put;
  let writes = 0;
  IDBObjectStore.prototype.put = function (
    ...args: Parameters<typeof original>
  ) {
    if (++writes === 2)
      throw new DOMException("Test quota failure", "QuotaExceededError");
    return original.apply(this, args);
  };
  try {
    await assert.rejects(db.import(preview), /Test quota failure/);
  } finally {
    IDBObjectStore.prototype.put = original;
  }
  assert.deepEqual((await db.export()).data, before);
});

test("leaving the page safely finishes an already authorized transaction", async (t) => {
  const name = `travel-test-${crypto.randomUUID()}`,
    db = await database(t, name);
  const saving = db.saveFootprint(footprint("CN"), null);
  db.close();
  await saving;
  const reopened = await database(t, name);
  assert.equal((await reopened.snapshot()).footprints.length, 1);
});
test("filters distinguish unknown dates and each footprint belongs to one mode", () => {
  const footprints: Footprint[] = [
    footprint("CN", "a"),
    { ...footprint("CN", "b"), time: null, visitType: "户外" },
    { ...footprint("CN", "c"), time: "2025", visitType: "居住" },
  ];
  assert.equal(filterFootprints(footprints, "2026", "旅游").length, 1);
  assert.equal(filterFootprints(footprints, "unknown", "")[0]?.id, "b");
  assert.equal(
    ["旅游", "户外", "居住"].reduce(
      (sum, type) => sum + filterFootprints(footprints, "", type).length,
      0,
    ),
    footprints.length,
  );
});

test("tree footprints stay on their direct region while counts include descendants", () => {
  const snapshot = {
    regions: [
      chinaRegion(),
      region("110000", "CN", "北京市"),
      region("110114", "110000", "昌平区"),
    ],
    footprints: [
      footprint("CN", "historic"),
      { ...footprint("110114", "unknown"), time: null },
      { ...footprint("110114", "recent"), time: "2026-09-11" },
    ],
  };
  const before = structuredClone(snapshot);
  const view = buildRegionTreeView(snapshot, snapshot.footprints, "", false);
  assert.deepEqual(
    view.footprintsByRegion.get("CN")?.map((item) => item.id),
    ["historic"],
  );
  assert.equal(view.footprintsByRegion.has("110000"), false);
  assert.deepEqual(
    view.footprintsByRegion.get("110114")?.map((item) => item.id),
    ["recent", "unknown"],
  );
  assert.equal(view.counts.get("CN"), 3);
  assert.equal(view.counts.get("110000"), 2);
  assert.equal(view.counts.get("110114"), 2);
  assert.deepEqual(snapshot, before);
});

test("tree search retains matching ancestor paths and respects visit filters", () => {
  const snapshot = {
    regions: [
      chinaRegion(),
      region("110000", "CN", "北京市"),
      { ...region("110114", "110000", "昌平区"), aliases: ["昌平"] },
      region("110101", "110000", "东城区"),
    ],
    footprints: [footprint("110114", "trip")],
  };
  for (const query of ["昌平", "110114"]) {
    const view = buildRegionTreeView(
      snapshot,
      snapshot.footprints,
      query,
      true,
    );
    assert.deepEqual([...view.visible].sort(), ["110000", "110114", "CN"]);
  }
  const empty = buildRegionTreeView(
    snapshot,
    filterFootprints(snapshot.footprints, "2025", ""),
    "",
    true,
  );
  assert.equal(empty.visible.size, 0);
  assert.equal(empty.footprintsByRegion.size, 0);
});

test("empty trees and region-only trees do not create placeholder footprints", () => {
  const empty = buildRegionTreeView(
    { regions: [], footprints: [] },
    [],
    "",
    false,
  );
  assert.equal(empty.visible.size, 0);
  const view = buildRegionTreeView(seed(), [], "", false);
  assert.deepEqual([...view.visible], ["CN"]);
  assert.equal(view.footprintsByRegion.size, 0);
  assert.equal(view.counts.size, 0);
});
