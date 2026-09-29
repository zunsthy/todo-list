import {
  coloredVisitTypes,
  footprintColor,
  visitColor,
} from "../map/footprints.ts";

// Samples of the continuous formula, not a discrete lookup table for cells.
const entries = [
  { label: "居住／求学", color: visitColor("居住", 10) },
  ...coloredVisitTypes.map((type) => ({
    label: type,
    color: visitColor(type, 10),
  })),
  { label: "无足迹", color: footprintColor() },
];

export default function MapLegend() {
  return (
    <aside
      className="travel-map-legend"
      aria-label="足迹图例：居住和求学为黑色，其余方式各有色相，按时间精度累计由浅到深"
    >
      {entries.map(({ label, color }) => (
        <div key={label}>
          <span style={{ backgroundColor: color }} aria-hidden="true" />
          {label}
        </div>
      ))}
    </aside>
  );
}
