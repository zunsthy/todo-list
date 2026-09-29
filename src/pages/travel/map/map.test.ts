import assert from "node:assert/strict";
import test from "node:test";
import { chinaRegion } from "../model.ts";
import type { Footprint, Region, RegionBoundary } from "../types.ts";
import { lab } from "d3";
import { mapGeometry, toWgs84, wgs84ToGcj02 } from "./coordinates.ts";
import { prepareBoundary, projectPosition } from "./geometry.ts";
import {
  footprintColor,
  footprintWeight,
  summarizeFootprints,
  coloredVisitTypes,
  visitColor,
} from "./footprints.ts";
import {
  boundaryFrontier,
  bufferedViewport,
  canExpandRegion,
  hexGridOffset,
  inViewport,
  visibleRegions,
  type RegionMetrics,
} from "./layout.ts";

const region = (
  id: string,
  parentId: string | null,
  boundaryKey: string | null,
): Region => ({ ...chinaRegion(), id, parentId, boundaryKey });

const footprint = (
  time: string | null,
  visitType: Footprint["visitType"] = "工作",
): Footprint => ({
  id: `${time}-${visitType}`,
  time,
  visitType,
  regionId: "CN",
  name: "测试",
  notes: "",
  pos: null,
});

test("footprints weight day/month/year precision without expanding records", () => {
  assert.deepEqual(
    ["2026-05-01", "2026-05", "2026", null, "2026-05-01T12:30"].map(
      footprintWeight,
    ),
    [1, 10, 50, 1, 1],
  );
  const stats = summarizeFootprints([
    footprint("2026-05-01"),
    footprint("2026-05"),
    footprint("2026"),
    footprint(null, "旅游"),
  ]);
  assert.equal(stats.count, 4);
  assert.equal(stats.weight, 62);
  assert.equal(stats.black, false);
  assert.deepEqual(stats.byType, {
    工作: { count: 3, weight: 61 },
    旅游: { count: 1, weight: 1 },
  });
});

test("residence and study override any weight; filtering them out restores blue", () => {
  const work = footprint("2026");
  for (const type of ["居住", "求学"] as const) {
    const records = [work, footprint("2026-05-01", type)];
    const before = structuredClone(records);
    assert.equal(footprintColor(summarizeFootprints(records)), "#000000");
    assert.notEqual(footprintColor(summarizeFootprints([work])), "#000000");
    assert.deepEqual(records, before);
  }
  assert.equal(footprintColor(summarizeFootprints([])), "#f2f2f2");
});

test("each category has a distinct hue and darkens on its own fixed scale", () => {
  assert.equal(
    new Set(coloredVisitTypes.map((type) => visitColor(type, 10))).size,
    6,
  );
  for (const type of coloredVisitTypes) {
    let previous = Infinity;
    for (const weight of [1, 2, 10, 50, 100, 10000]) {
      const color = visitColor(type, weight);
      assert.notEqual(color, "#000000");
      assert(lab(color).l < previous);
      previous = lab(color).l;
    }
  }
  assert.equal(
    footprintColor(summarizeFootprints([footprint("2026-05")])),
    footprintColor(
      summarizeFootprints(
        Array.from({ length: 10 }, () => footprint("2026-05-01")),
      ),
    ),
  );
});

test("mixed cells use the heaviest category with stable tie breaking", () => {
  const records = [
    footprint("2026-05-01", "工作"),
    footprint("2026-05", "户外"),
  ];
  assert.equal(
    footprintColor(summarizeFootprints(records)),
    visitColor("户外", 10),
  );
  const tied = [footprint("2026", "工作"), footprint("2026", "旅游")];
  assert.equal(
    footprintColor(summarizeFootprints(tied)),
    visitColor("旅游", 50),
  );
  assert.equal(
    footprintColor(summarizeFootprints([...tied].reverse())),
    visitColor("旅游", 50),
  );
});

test("footprint positions use the boundary projection and their own CRS", () => {
  const original: [number, number] = [116.404, 39.915];
  const wgs = projectPosition({
    coordinates: original,
    coordinateSystem: "WGS84",
  })!;
  const gcj = projectPosition({
    coordinates: wgs84ToGcj02(original),
    coordinateSystem: "GCJ02",
  })!;
  for (let axis = 0; axis < 2; axis++)
    assert(Math.abs(wgs[axis]! - gcj[axis]!) < 1e-6);
  assert.deepEqual(original, [116.404, 39.915]);
});

test("hex grid origins stay aligned to map coordinates across pan and row wraps", () => {
  const radius = 6.5;
  const periods = [radius * Math.sqrt(3), radius * 3];
  for (const [x, y] of [
    [0, 0],
    [37.25, 19.75],
    [-63.4, -28.2],
    [-14392.6, -8457.25],
  ] as const) {
    const camera = { x, y, k: 6.5 };
    const offset = hexGridOffset(camera, radius);
    for (let axis = 0; axis < 2; axis++) {
      const period = periods[axis]!;
      const translation = axis === 0 ? camera.x : camera.y;
      const cycles = (translation - offset[axis]!) / period;
      assert(Math.abs(cycles - Math.round(cycles)) < 1e-9);
      assert(offset[axis]! <= -period && offset[axis]! >= -2 * period);
    }
    const oneRow = hexGridOffset({ ...camera, y: y + radius * 1.5 }, radius);
    const worldRowShift =
      (oneRow[1] - (y + radius * 1.5) - (offset[1] - y)) / (radius * 1.5);
    assert(Math.abs(worldRowShift / 2 - Math.round(worldRowShift / 2)) < 1e-9);
  }
});

test("the render buffer is 1.2 times the viewport without changing map scale", () => {
  const camera = { x: -40, y: 20, k: 3 };
  const size = { width: 1000, height: 600 };
  const buffer = bufferedViewport(camera, size);
  assert.deepEqual(buffer.size, { width: 1200, height: 720 });
  assert.deepEqual(buffer.offset, [100, 60]);
  assert.deepEqual(buffer.camera, { x: 60, y: 80, k: 3 });
  assert.deepEqual(camera, { x: -40, y: 20, k: 3 });
  const edge: RegionMetrics = {
    bounds: [
      [365, 30],
      [370, 40],
    ],
    area: 50,
  };
  assert.equal(inViewport(edge.bounds, camera, size), false);
  assert.equal(inViewport(edge.bounds, buffer.camera, buffer.size), true);
  const offscreen = region("edge", null, "edge-boundary");
  const view = visibleRegions(
    [offscreen],
    new Map([["edge-boundary", edge]]),
    buffer.camera,
    buffer.size,
  );
  assert.deepEqual(view.visible, [offscreen]);
});

test("display conversion respects CRS without changing stored coordinates", () => {
  const original: [number, number] = [116.404, 39.915];
  const gcj = wgs84ToGcj02(original);
  assert(Math.abs(gcj[0] - 116.4102445) < 1e-6);
  assert(Math.abs(gcj[1] - 39.9164043) < 1e-6);
  const restored = toWgs84(gcj, "GCJ02");
  assert(Math.abs(restored[0] - original[0]) < 1e-7);
  assert(Math.abs(restored[1] - original[1]) < 1e-7);
  assert.deepEqual(toWgs84([2.35, 48.86], "GCJ02"), [2.35, 48.86]);
  assert.deepEqual(original, [116.404, 39.915]);
});

test("both ring windings project to the same small region and retain holes", () => {
  const boundary: RegionBoundary = {
    key: "test",
    coordinateSystem: "WGS84",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [100, 20],
          [102, 20],
          [102, 22],
          [100, 22],
          [100, 20],
        ],
        [
          [100.5, 20.5],
          [100.5, 21],
          [101, 21],
          [101, 20.5],
          [100.5, 20.5],
        ],
      ],
    },
  };
  const before = structuredClone(boundary);
  const shape = prepareBoundary(boundary);
  const reversed = structuredClone(boundary);
  for (const ring of reversed.geometry.coordinates)
    (ring as [number, number][]).reverse();
  assert(Math.abs(shape.area - prepareBoundary(reversed).area) < 1e-7);
  assert(shape.bounds[1][0] - shape.bounds[0][0] < 20);
  assert.equal(shape.geometry.coordinates[0]!.length, 2);
  assert.equal(mapGeometry(boundary).type, "MultiPolygon");
  assert.deepEqual(boundary, before);
});

test("detail thresholds use screen area, not named administrative levels", () => {
  const shape: RegionMetrics = {
    bounds: [
      [0, 0],
      [100, 100],
    ],
    area: 8000,
  };
  assert.equal(canExpandRegion(shape, 1, 12), false);
  assert.equal(canExpandRegion(shape, 3, 12), true);
});

test("missing parent boundaries fall through; children load only when sufficiently zoomed", () => {
  const regions = [
    region("CN", null, null),
    region("530000", "CN", "province"),
    region("530100", "530000", "city"),
  ];
  assert.deepEqual(
    boundaryFrontier(regions).map((r) => r.id),
    ["530000"],
  );
  const metrics = new Map<string, RegionMetrics>([
    [
      "province",
      {
        bounds: [
          [0, 0],
          [100, 100],
        ],
        area: 8000,
      },
    ],
  ]);
  const size = { width: 600, height: 600 };
  const low = visibleRegions(regions, metrics, { x: 0, y: 0, k: 1 }, size);
  assert.deepEqual(
    low.visible.map((r) => r.id),
    ["530000"],
  );
  assert.deepEqual(low.needed, []);
  const high = visibleRegions(regions, metrics, { x: 0, y: 0, k: 3 }, size);
  assert.deepEqual(high.needed, ["city"]);
  metrics.set("city", {
    bounds: [
      [10, 10],
      [35, 35],
    ],
    area: 500,
  });
  assert.deepEqual(
    visibleRegions(regions, metrics, { x: 0, y: 0, k: 3 }, size).visible.map(
      (r) => r.id,
    ),
    ["530100"],
  );
  assert.deepEqual(
    visibleRegions(regions, metrics, { x: -1000, y: 0, k: 1 }, size).visible,
    [],
  );
});

test("each branch displays a mutually exclusive frontier through multiple levels", () => {
  const regions = [
    region("CN", null, "country"),
    region("530000", "CN", "province"),
    region("530100", "530000", "city"),
    region("530102", "530100", "district"),
    region("530300", "530000", "sibling"),
  ];
  const metrics = new Map<string, RegionMetrics>([
    [
      "country",
      {
        bounds: [
          [0, 0],
          [200, 200],
        ],
        area: 36000,
      },
    ],
    [
      "province",
      {
        bounds: [
          [0, 0],
          [100, 100],
        ],
        area: 8000,
      },
    ],
    [
      "city",
      {
        bounds: [
          [10, 10],
          [50, 50],
        ],
        area: 1500,
      },
    ],
    [
      "district",
      {
        bounds: [
          [15, 15],
          [30, 30],
        ],
        area: 200,
      },
    ],
    [
      "sibling",
      {
        bounds: [
          [60, 0],
          [95, 40],
        ],
        area: 1200,
      },
    ],
  ]);
  const size = { width: 600, height: 600 };
  const idsAt = (k: number) =>
    visibleRegions(regions, metrics, { x: 0, y: 0, k }, size).visible.map(
      (r) => r.id,
    );
  assert.deepEqual(idsAt(0.5), ["CN"]);
  assert.deepEqual(idsAt(1), ["530000"]);
  assert.deepEqual(idsAt(3), ["530100", "530300"]);
  assert.deepEqual(idsAt(5), ["530102", "530300"]);
  assert.deepEqual(idsAt(1), ["530000"]);
});

test("partial imports stay blank after panning past the imported children", () => {
  const regions = [
    region("CN", null, null),
    region("530000", "CN", "province"),
    region("530100", "530000", "city"),
  ];
  const metrics = new Map<string, RegionMetrics>([
    [
      "province",
      {
        bounds: [
          [0, 0],
          [100, 100],
        ],
        area: 8000,
      },
    ],
    [
      "city",
      {
        bounds: [
          [0, 0],
          [30, 30],
        ],
        area: 700,
      },
    ],
  ]);
  const size = { width: 200, height: 200 };
  assert.deepEqual(
    visibleRegions(regions, metrics, { x: 0, y: 0, k: 3 }, size).visible.map(
      (r) => r.id,
    ),
    ["530100"],
  );
  assert.deepEqual(
    visibleRegions(regions, metrics, { x: -160, y: 0, k: 3 }, size).visible,
    [],
  );
  assert.deepEqual(
    visibleRegions(regions, metrics, { x: 0, y: 0, k: 1 }, size).visible.map(
      (r) => r.id,
    ),
    ["530000"],
  );
});

test("missing intermediate boundaries do not hide even tiny descendants", () => {
  const regions = [
    region("CN", null, null),
    region("530000", "CN", "province"),
    region("530100", "530000", "city"),
    region("530102", "530100", "district"),
  ];
  const metrics = new Map<string, RegionMetrics>([
    [
      "province",
      {
        bounds: [
          [0, 0],
          [100, 100],
        ],
        area: 8000,
      },
    ],
    [
      "district",
      {
        bounds: [
          [10, 10],
          [12, 12],
        ],
        area: 3,
      },
    ],
  ]);
  const camera = { x: 0, y: 0, k: 3 };
  const size = { width: 600, height: 600 };
  const missing = new Set(["city"]);
  assert.deepEqual(
    visibleRegions(regions, metrics, camera, size, missing).visible.map(
      (r) => r.id,
    ),
    ["530102"],
  );
  missing.add("district");
  assert.deepEqual(
    visibleRegions(regions, metrics, camera, size, missing).visible.map(
      (r) => r.id,
    ),
    ["530000"],
  );
});

test("expanding a province keeps small cities alongside their larger siblings", () => {
  const regions = [
    region("420000", null, "province"),
    region("421000", "420000", "city"),
    region("429005", "420000", "small"),
  ];
  const metrics = new Map<string, RegionMetrics>([
    [
      "province",
      {
        bounds: [
          [0, 0],
          [30, 30],
        ],
        area: 663,
      },
    ],
    [
      "city",
      {
        bounds: [
          [0, 0],
          [8, 8],
        ],
        area: 49,
      },
    ],
    [
      "small",
      {
        bounds: [
          [10, 10],
          [13, 13],
        ],
        area: 7,
      },
    ],
  ]);
  const idsAt = (k: number) =>
    visibleRegions(
      regions,
      metrics,
      { x: 0, y: 0, k },
      { width: 600, height: 600 },
    ).visible.map((r) => r.id);
  assert.deepEqual(idsAt(6.5), ["421000", "429005"]);
  assert.deepEqual(idsAt(3), ["420000"]);
});
