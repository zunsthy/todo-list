export const coordinateSystems = ["WGS84", "GCJ02", "BD09LL"] as const;
export const visitTypes = [
  "旅游",
  "户外",
  "居住",
  "工作",
  "探亲",
  "求学",
  "中转",
] as const;
export type CoordinateSystem = (typeof coordinateSystems)[number];
export type LngLat = [longitude: number, latitude: number];
export interface Pos {
  coordinates: LngLat;
  coordinateSystem: CoordinateSystem;
}
export interface Region {
  id: string;
  parentId: string | null;
  name: string;
  aliases: string[];
  kind: string;
  classification: "administrative" | "functional" | "custom";
  sortOrder: number;
  notes: string;
  pos: Pos | null;
  boundaryKey: string | null;
  state: "unloaded" | "partial" | "complete";
  importedAt?: string;
}
export interface Footprint {
  id: string;
  time: string | null;
  regionId: string;
  name: string;
  visitType: (typeof visitTypes)[number];
  notes: string;
  pos: Pos | null;
}
export interface RegionBoundary {
  key: string;
  coordinateSystem: CoordinateSystem;
  geometry:
    | { type: "Polygon"; coordinates: LngLat[][] }
    | { type: "MultiPolygon"; coordinates: LngLat[][][] };
}
export interface TravelSnapshot {
  regions: Region[];
  footprints: Footprint[];
}
export interface TravelData extends TravelSnapshot {
  regionBoundaries: RegionBoundary[];
}
export interface FootprintExport {
  format: "todo-list-footprints";
  version: 1;
  exportedAt: string;
  data: TravelData;
}
export interface RegionChildrenImport {
  format: "todo-list-region-children";
  version: 1;
  parentId: string;
  coverage: "partial" | "complete";
  children: Array<
    Pick<Region, "id" | "name" | "kind" | "pos"> &
      Partial<
        Pick<
          Region,
          "aliases" | "classification" | "sortOrder" | "notes" | "boundaryKey"
        >
      >
  >;
  boundaries?: RegionBoundary[];
}
export interface ImportChange {
  store: keyof TravelData;
  id: string;
  name: string;
  before?: Region | Footprint | RegionBoundary;
  after: Region | Footprint | RegionBoundary;
}
export interface ImportPlan {
  data: TravelData;
  changes: ImportChange[];
  warnings: string[];
}
export interface ImportPreview {
  source: unknown;
  parentId: string | null;
  baseline: string;
  plan: ImportPlan;
}
