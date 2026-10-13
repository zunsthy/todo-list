import { geoMercator, geoPath, geoStream, type GeoStream } from "d3";
import type { MultiPolygon } from "geojson";
import type { Pos, RegionBoundary } from "../types.ts";
import { mapGeometry, toWgs84 } from "./coordinates.ts";
import type { Point, RegionMetrics } from "./layout.ts";

const projection = geoMercator()
  .scale(2048 / (2 * Math.PI))
  .translate([1024, 1024])
  .precision(0.02);
const planarPath = geoPath(null);

export const projectPosition = (pos: Pos): Point | null => {
  const point = projection(toWgs84(pos.coordinates, pos.coordinateSystem));
  return point?.every(Number.isFinite) ? point : null;
};

// Local ground distance for the same spherical Mercator used by boundaries.
// Outside the projection's clipped world, a scale would be misleading.
export const metersPerMapUnit = (point: Point): number | null => {
  if (!point.every(Number.isFinite)) return null;
  const latitude = projection.invert!(point)?.[1];
  const limit = (Math.atan(Math.sinh(Math.PI)) * 180) / Math.PI;
  if (
    latitude === undefined ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > limit
  )
    return null;
  return (
    (6371008.8 * Math.cos((latitude * Math.PI) / 180)) / projection.scale()
  );
};

export interface PreparedBoundary extends RegionMetrics {
  geometry: MultiPolygon;
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
  };
};
