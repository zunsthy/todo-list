declare module "d3-hexgrid" {
  import type {
    GeoPath,
    GeoPermissibleObjects,
    GeoProjection,
    GeoIdentityTransform,
  } from "d3";
  export interface HexCell {
    x: number;
    y: number;
    cover: number;
    gridpoint: number;
  }
  export interface HexLayout {
    (points: { x: number; y: number }[]): { x: number; y: number }[];
    centers(): [number, number][];
    hexagon(radius?: number): string;
    grid: { layout: HexCell[] };
  }
  export interface HexGrid {
    (points: { longitude: number; latitude: number }[]): HexLayout;
    extent(size: [number, number]): this;
    geography(geo: GeoPermissibleObjects): this;
    projection(projection: GeoProjection | GeoIdentityTransform): this;
    pathGenerator(path: GeoPath): this;
    hexRadius(radius: number): this;
    edgePrecision(precision: number): this;
  }
  export function hexgrid(): HexGrid;
}
