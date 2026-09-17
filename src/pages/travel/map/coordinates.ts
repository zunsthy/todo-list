import type { CoordinateSystem, LngLat, RegionBoundary } from "../types.ts";

// Coordinate formulae adapted from https://github.com/wandergis/coordtransform.
// MIT License, Copyright (c) 2015 记忆的残骸
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

const pi = Math.PI;
const outsideChina = ([lng, lat]: LngLat) =>
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;

export const wgs84ToGcj02 = (point: LngLat): LngLat => {
  if (outsideChina(point)) return [...point];
  const [lng, lat] = point,
    x = lng - 105,
    y = lat - 35;
  const wave = (
    a: number,
    b: number,
    t: number,
    period: number,
    second = period * 3,
  ) =>
    ((a * Math.sin((t * pi) / period) + b * Math.sin((t * pi) / second)) * 2) /
    3;
  const common =
    ((20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2) / 3;
  const dy =
    -100 +
    2 * x +
    3 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x)) +
    common +
    wave(20, 40, y, 1) +
    wave(160, 320, y, 12, 30);
  const dx =
    300 +
    x +
    2 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x)) +
    common +
    wave(20, 40, x, 1) +
    wave(150, 300, x, 12, 30);
  const latitude = (lat * pi) / 180;
  const magic = 1 - 0.00669342162296594323 * Math.sin(latitude) ** 2;
  return [
    lng + (dx * 180) / ((6378245 / Math.sqrt(magic)) * Math.cos(latitude) * pi),
    lat +
      (dy * 180) /
        (((6378245 * (1 - 0.00669342162296594323)) / magic ** 1.5) * pi),
  ];
};

export const toWgs84 = (point: LngLat, system: CoordinateSystem): LngLat => {
  if (system === "WGS84") return [...point];
  let target: LngLat = [...point];
  if (system === "BD09LL") {
    const x = point[0] - 0.0065,
      y = point[1] - 0.006,
      wave = (pi * 3000) / 180;
    const distance = Math.hypot(x, y) - 0.00002 * Math.sin(y * wave);
    const angle = Math.atan2(y, x) - 0.000003 * Math.cos(x * wave);
    target = [distance * Math.cos(angle), distance * Math.sin(angle)];
  }
  if (outsideChina(target)) return target;
  let guess: LngLat = [...target];
  for (let i = 0; i < 3; i++) {
    const forward = wgs84ToGcj02(guess);
    guess = [
      guess[0] + target[0] - forward[0],
      guess[1] + target[1] - forward[1],
    ];
  }
  return guess;
};

// D3's spherical polygons use clockwise outer rings. Stored GeoJSON may use
// either winding. Normalize a copy for rendering without changing the backup.
export const mapGeometry = (
  boundary: RegionBoundary,
): RegionBoundary["geometry"] => {
  const polygons =
    boundary.geometry.type === "Polygon"
      ? [boundary.geometry.coordinates]
      : boundary.geometry.coordinates;
  const result = polygons.map((polygon) =>
    polygon.map((ring, index) => {
      const points = ring.map((point) =>
        toWgs84(point, boundary.coordinateSystem),
      );
      let signedArea = 0,
        longitude = points[0]![0];
      for (let i = 1; i < points.length; i++) {
        const previous = points[i - 1]!,
          current = points[i]!;
        const dx = ((current[0] - previous[0] + 540) % 360) - 180;
        signedArea += longitude * current[1] - (longitude + dx) * previous[1];
        longitude += dx;
      }
      if ((index === 0 && signedArea > 0) || (index > 0 && signedArea < 0))
        points.reverse();
      return points;
    }),
  );
  return { type: "MultiPolygon", coordinates: result };
};
