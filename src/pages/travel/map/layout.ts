import type { Region } from "../types.ts";

export type Point = [number, number];
export type Bounds = [Point, Point];
export interface Camera {
  x: number;
  y: number;
  k: number;
}
export interface RegionMetrics {
  bounds: Bounds;
  area: number;
}
export interface Size {
  width: number;
  height: number;
}

export const HEX_RADIUS = 6;
export const hexGridOffset = (camera: Camera, radius: number): Point => {
  // Two rows form a repeating rectangle; a single-row offset would change
  // the staggered column alignment. Keep extra cells above/left for clipping.
  const periods: Point = [radius * Math.sqrt(3), radius * 3];
  return periods.map((period, axis) => {
    const translation = axis === 0 ? camera.x : camera.y;
    return (((translation % period) + period) % period) - 2 * period;
  }) as Point;
};
export const bufferedViewport = (camera: Camera, size: Size) => {
  const offset: Point = [
    Math.ceil(size.width / 10),
    Math.ceil(size.height / 10),
  ];
  return {
    offset,
    camera: { x: camera.x + offset[0], y: camera.y + offset[1], k: camera.k },
    size: {
      width: size.width + offset[0] * 2,
      height: size.height + offset[1] * 2,
    },
  };
};
export const screenSize = (metrics: RegionMetrics, k: number) => ({
  width: (metrics.bounds[1][0] - metrics.bounds[0][0]) * k,
  height: (metrics.bounds[1][1] - metrics.bounds[0][1]) * k,
  area: metrics.area * k * k,
});
export const canExpandRegion = (
  metrics: RegionMetrics,
  k: number,
  children: number,
) => {
  const size = screenSize(metrics, k);
  return (
    children > 0 &&
    size.area >= 26000 &&
    Math.min(size.width, size.height) >= 150 &&
    Math.sqrt(size.area / children) >= 32
  );
};
export const inViewport = (
  bounds: Bounds,
  camera: Camera,
  size: Size,
  padding = 20,
) =>
  bounds[1][0] * camera.k + camera.x >= -padding &&
  bounds[0][0] * camera.k + camera.x <= size.width + padding &&
  bounds[1][1] * camera.k + camera.y >= -padding &&
  bounds[0][1] * camera.k + camera.y <= size.height + padding;

export const boundaryFrontier = (
  regions: Region[],
  parentId: string | null = null,
): Region[] => {
  const children = new Map<string | null, Region[]>();
  for (const region of regions)
    children.set(region.parentId, [
      ...(children.get(region.parentId) ?? []),
      region,
    ]);
  const visit = (region: Region): Region[] =>
    region.boundaryKey
      ? [region]
      : (children.get(region.id) ?? []).flatMap(visit);
  const parent =
    parentId === null ? undefined : regions.find((r) => r.id === parentId);
  return parent ? visit(parent) : (children.get(null) ?? []).flatMap(visit);
};

export const visibleRegions = (
  regions: Region[],
  metrics: ReadonlyMap<string, RegionMetrics>,
  camera: Camera,
  size: Size,
  missing: ReadonlySet<string> = new Set(),
) => {
  const children = new Map<string | null, Region[]>();
  for (const region of regions)
    children.set(region.parentId, [
      ...(children.get(region.parentId) ?? []),
      region,
    ]);
  const needed = new Set<string>();
  const visit = (region: Region): Region[] => {
    const descendants = children.get(region.id) ?? [];
    if (!region.boundaryKey || missing.has(region.boundaryKey))
      return descendants.flatMap(visit);
    const shape = metrics.get(region.boundaryKey);
    if (!shape) {
      needed.add(region.boundaryKey);
      return [];
    }
    if (
      inViewport(shape.bounds, camera, size) &&
      canExpandRegion(shape, camera.k, descendants.length)
    ) {
      const lower = descendants.flatMap(visit);
      // Once a branch expands, include all available children regardless of
      // their individual size; filtering small siblings would leave holes.
      // Select either this region or its descendants, never both. Keep
      // offscreen children in the selection until culling, so panning into
      // an unimported part of the parent does not bring that parent back.
      if (lower.length) return lower;
    }
    return [region];
  };
  const visible = (children.get(null) ?? [])
    .flatMap(visit)
    .filter((region) =>
      inViewport(metrics.get(region.boundaryKey!)!.bounds, camera, size),
    );
  return { visible, needed: [...needed] };
};

export const fitBounds = (bounds: Bounds, size: Size): Camera => {
  const width = Math.max(bounds[1][0] - bounds[0][0], 1e-6);
  const height = Math.max(bounds[1][1] - bounds[0][1], 1e-6);
  const k = Math.max(
    0.1,
    Math.min(
      16384,
      Math.min((size.width - 60) / width, (size.height - 60) / height),
    ),
  );
  return {
    k,
    x: size.width / 2 - ((bounds[0][0] + bounds[1][0]) / 2) * k,
    y: size.height / 2 - ((bounds[0][1] + bounds[1][1]) / 2) * k,
  };
};

// Iterative Douglas–Peucker for a display-only copy, within half a CSS pixel.
export const simplifyRing = (points: Point[], tolerance: number): Point[] => {
  if (points.length < 5) return points;
  const squared = tolerance * tolerance,
    keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!,
      a = points[start]!,
      b = points[end]!;
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = dx * dx + dy * dy;
    let furthest = -1,
      distance = squared;
    for (let i = start + 1; i < end; i++) {
      const p = points[i]!;
      const t = length
        ? Math.max(
            0,
            Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length),
          )
        : 0;
      const d = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
      if (d > distance) {
        distance = d;
        furthest = i;
      }
    }
    if (furthest >= 0) {
      keep[furthest] = 1;
      stack.push([start, furthest], [furthest, end]);
    }
  }
  const result = points.filter((_, i) => keep[i]);
  return result.length >= 4 ? result : points;
};
