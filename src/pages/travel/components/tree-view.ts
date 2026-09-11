import { buildTree } from "../model.ts";
import type { Footprint, TravelSnapshot } from "../types.ts";

export const buildRegionTreeView = (
  snapshot: TravelSnapshot,
  footprints: Footprint[],
  query: string,
  visitedOnly: boolean,
) => {
  const tree = buildTree(snapshot);
  const counts = new Map<string, number>();
  const footprintsByRegion = new Map<string, Footprint[]>();
  const matching = new Set<string>();
  for (const footprint of footprints) {
    const records = footprintsByRegion.get(footprint.regionId) ?? [];
    records.push(footprint);
    footprintsByRegion.set(footprint.regionId, records);
    for (const region of tree.path(footprint.regionId))
      counts.set(region.id, (counts.get(region.id) ?? 0) + 1);
  }
  for (const records of footprintsByRegion.values())
    records.sort(
      (a, b) =>
        (b.time ?? "").localeCompare(a.time ?? "") ||
        a.name.localeCompare(b.name, "zh-CN"),
    );
  const needle = query.trim().toLocaleLowerCase();
  for (const region of snapshot.regions) {
    if (
      !needle ||
      [region.id, region.name, ...region.aliases].some((value) =>
        value.toLocaleLowerCase().includes(needle),
      )
    )
      for (const parent of tree.path(region.id)) matching.add(parent.id);
  }
  const visible = new Set(
    [...matching].filter((id) => !visitedOnly || counts.has(id)),
  );
  return { tree, counts, footprintsByRegion, visible };
};
