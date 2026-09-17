import { geoMercator, geoPath, geoStream, type GeoStream } from "d3";
import type { MultiPolygon } from "geojson";
import type { RegionBoundary } from "../types.ts";
import { mapGeometry } from "./coordinates.ts";
import { simplifyRing, type Point, type RegionMetrics } from "./layout.ts";

const projection = geoMercator()
  .scale(2048 / (2 * Math.PI))
  .translate([1024, 1024])
  .precision(0.02);
const planarPath = geoPath(null);

export interface PreparedBoundary extends RegionMetrics {
  geometry: MultiPolygon;
  levels: Map<number, MultiPolygon>;
}

export const prepareBoundary = (boundary: RegionBoundary): PreparedBoundary => {
  const polygons: Point[][][] = [];
  let polygon: Point[][] = [],
    ring: Point[] = [];
  const sink: GeoStream = {
    point(x, y) {
      ring.push([x, y]);
    },
    lineStart() {
      ring = [];
      polygon.push(ring);
    },
    lineEnd() {
      if (
        ring.length &&
        (ring[0]![0] !== ring[ring.length - 1]![0] ||
          ring[0]![1] !== ring[ring.length - 1]![1])
      )
        ring.push([...ring[0]!]);
    },
    polygonStart() {
      polygon = [];
      polygons.push(polygon);
    },
    polygonEnd() {},
    sphere() {},
  };
  geoStream(mapGeometry(boundary), projection.stream(sink));
  const geometry: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: polygons
      .map((p) => p.filter((r) => r.length >= 4))
      .filter((p) => p.length),
  };
  const bounds = planarPath.bounds(geometry);
  if (!bounds.flat().every(Number.isFinite) || !geometry.coordinates.length)
    throw new Error("边界无法投影到地图");
  return {
    geometry,
    bounds,
    area: planarPath.area(geometry),
    levels: new Map(),
  };
};

export const displayGeometry = (
  boundary: PreparedBoundary,
  scale: number,
): MultiPolygon => {
  const level = Math.ceil(Math.log2(scale));
  let geometry = boundary.levels.get(level);
  if (!geometry) {
    geometry = {
      type: "MultiPolygon",
      coordinates: boundary.geometry.coordinates.map((polygon) =>
        polygon.map((ring) => simplifyRing(ring as Point[], 0.35 / 2 ** level)),
      ),
    };
    boundary.levels.set(level, geometry);
    if (boundary.levels.size > 3)
      boundary.levels.delete(boundary.levels.keys().next().value!);
  }
  return geometry;
};
