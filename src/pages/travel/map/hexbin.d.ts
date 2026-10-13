declare module "d3-hexbin" {
  export interface Hexbin<T> {
    (points: T[]): (T[] & { x: number; y: number })[];
    extent(extent: [[number, number], [number, number]]): this;
    radius(radius: number): this;
    x(accessor: (point: T) => number): this;
    y(accessor: (point: T) => number): this;
    centers(): [number, number][];
    hexagon(radius?: number): string;
  }
  export function hexbin<T = [number, number]>(): Hexbin<T>;
}
