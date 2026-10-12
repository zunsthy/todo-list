import { metersPerMapUnit } from "./geometry.ts";
import { hexRadius, type Camera, type Size } from "./layout.ts";

const MIN_HEX_METERS = 1000;

// Use the grid's horizontal cell spacing, not the scale bar's label. Both
// distance calculations refer to the latitude at the viewport center.
export const maxMapZoom = (camera: Camera, size: Size): number => {
  const units = metersPerMapUnit([
    (size.width / 2 - camera.x) / camera.k,
    (size.height / 2 - camera.y) / camera.k,
  ]);
  return Math.max(
    0.1,
    Math.min(
      16384,
      units === null
        ? camera.k
        : (hexRadius(size) * Math.sqrt(3) * units) / MIN_HEX_METERS,
    ),
  );
};

// Programmatic transforms (focus/reset/resize) bypass D3's scale extent.
// Clamp them too, keeping the target's geographic center in place.
export const limitMapZoom = (camera: Camera, size: Size): Camera => {
  const k = Math.min(camera.k, maxMapZoom(camera, size));
  if (k === camera.k) return camera;
  const ratio = k / camera.k;
  return {
    k,
    x: size.width / 2 - (size.width / 2 - camera.x) * ratio,
    y: size.height / 2 - (size.height / 2 - camera.y) * ratio,
  };
};

export interface MapScaleBar {
  meters: number;
  width: number;
  label: string;
}

export const mapScaleBar = (camera: Camera, size: Size): MapScaleBar | null => {
  if (
    ![camera.x, camera.y, camera.k, size.width, size.height].every(
      Number.isFinite,
    ) ||
    camera.k <= 0 ||
    size.width < 120 ||
    size.height < 48
  )
    return null;
  const units = metersPerMapUnit([
    (size.width / 2 - camera.x) / camera.k,
    (size.height / 2 - camera.y) / camera.k,
  ]);
  if (units === null) return null;
  const metersPerPixel = units / camera.k;
  const maximum = metersPerPixel * Math.min(120, size.width / 3);
  if (!Number.isFinite(maximum) || maximum <= 0) return null;
  const step = 10 ** Math.floor(Math.log10(maximum));
  const factor = maximum / step;
  const meters = (factor >= 5 ? 5 : factor >= 2 ? 2 : 1) * step;
  const value = meters >= 1000 ? meters / 1000 : meters;
  return {
    meters,
    width: meters / metersPerPixel,
    label: `${Number(value.toPrecision(3))} ${meters >= 1000 ? "km" : "m"}`,
  };
};
