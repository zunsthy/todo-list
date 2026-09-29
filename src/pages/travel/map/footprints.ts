import { hcl } from "d3";
import type { Footprint } from "../types.ts";

export interface FootprintStats {
  count: number;
  weight: number;
  black: boolean;
  byType: Partial<
    Record<Footprint["visitType"], { count: number; weight: number }>
  >;
}

// Time is validated by the model. Day/minute precision both contribute one.
// Unknown precision contributes one record, not an invented duration.
export const footprintWeight = (time: Footprint["time"]): number =>
  time?.length === 4 ? 50 : time?.length === 7 ? 10 : 1;

export const summarizeFootprints = (
  footprints: readonly Footprint[],
): FootprintStats => {
  const stats: FootprintStats = {
    count: 0,
    weight: 0,
    black: false,
    byType: {},
  };
  for (const footprint of footprints) {
    const weight = footprintWeight(footprint.time);
    stats.count++;
    stats.weight += weight;
    stats.black ||= ["居住", "求学"].includes(footprint.visitType);
    const type = (stats.byType[footprint.visitType] ??= {
      count: 0,
      weight: 0,
    });
    type.count++;
    type.weight += weight;
  }
  return stats;
};

const visitHues = {
  旅游: 65,
  户外: 145,
  工作: 250,
  办事: 25,
  探亲: 310,
  中转: 95,
};
export const coloredVisitTypes = Object.keys(
  visitHues,
) as (keyof typeof visitHues)[];

export const visitColor = (
  type: Footprint["visitType"],
  weight: number,
): string => {
  if (type === "居住" || type === "求学") return "#000000";
  // Each category keeps its hue; only chroma/lightness depend on its weight.
  const t = weight / (weight + 4);
  const chroma = (type === "中转" ? 36 : 20) + 12 * t;
  return hcl(visitHues[type], chroma, 86 - 44 * t).formatHex();
};

export const footprintColor = (
  stats?: Pick<FootprintStats, "black" | "weight" | "byType">,
): string => {
  if (stats?.black) return "#000000";
  if (!stats?.weight) return "#f2f2f2";
  let dominant: (typeof coloredVisitTypes)[number] | undefined;
  let weight = 0;
  // Stable category order breaks ties, independently of input/pan order.
  for (const type of coloredVisitTypes) {
    const nextWeight = stats.byType[type]?.weight ?? 0;
    if (nextWeight > weight) {
      dominant = type;
      weight = nextWeight;
    }
  }
  return dominant ? visitColor(dominant, weight) : "#f2f2f2";
};
