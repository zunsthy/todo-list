import { visitTypes } from "../types.ts";
import type { Footprint } from "../types.ts";

export const Overview = ({
  footprints,
  filteredFootprints,
  countriesVisited,
  query,
  year,
  visitType,
  visitedOnly,
  onQueryChange,
  onYearChange,
  onVisitTypeChange,
  onVisitedOnlyChange,
  view,
  onViewChange,
}: {
  footprints: Footprint[];
  filteredFootprints: Footprint[];
  countriesVisited: number;
  query: string;
  year: string;
  visitType: string;
  visitedOnly: boolean;
  onQueryChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onVisitTypeChange: (value: string) => void;
  onVisitedOnlyChange: (value: boolean) => void;
  view: "tree" | "map";
  onViewChange: (view: "tree" | "map") => void;
}) => {
  const years = [
    ...new Set([
      ...footprints.flatMap((footprint) =>
        footprint.time ? [footprint.time.slice(0, 4)] : [],
      ),
      ...(year && year !== "unknown" ? [year] : []),
    ]),
  ]
    .sort()
    .reverse();
  return (
    <section className="travel-overview" aria-label="地区搜索与足迹筛选">
      <div
        className="travel-actions travel-view-switch"
        role="group"
        aria-label="足迹视图"
      >
        <button
          type="button"
          aria-pressed={view === "tree"}
          onClick={() => onViewChange("tree")}
        >
          树形
        </button>
        <button
          type="button"
          aria-pressed={view === "map"}
          onClick={() => onViewChange("map")}
        >
          地图
        </button>
      </div>
      <label className="travel-search">
        <input
          type="search"
          aria-label="查找地区"
          placeholder="名称、别名或编码"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      {view === "tree" && (
        <>
          <div className="travel-statistics">
            <div className="travel-stat">
              <strong>{filteredFootprints.length}</strong>
              <span>条足迹</span>
            </div>
            <div className="travel-stat">
              <strong>
                {
                  new Set(
                    filteredFootprints.map((footprint) => footprint.regionId),
                  ).size
                }
              </strong>
              <span>个直接到访地区</span>
            </div>
            <div className="travel-stat">
              <strong>{countriesVisited}</strong>
              <span>个到访国家</span>
            </div>
          </div>
          <div className="travel-filters">
            <label>
              年份
              <select
                value={year}
                onChange={(event) => onYearChange(event.target.value)}
              >
                <option value="">全部时间</option>
                {years.map((value) => (
                  <option key={value}>{value}</option>
                ))}
                <option value="unknown">时间未知</option>
              </select>
            </label>
            <label>
              方式
              <select
                value={visitType}
                onChange={(event) => onVisitTypeChange(event.target.value)}
              >
                <option value="">全部方式</option>
                {visitTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="travel-checkbox">
              <input
                type="checkbox"
                checked={visitedOnly}
                onChange={(event) => onVisitedOnlyChange(event.target.checked)}
              />
              只看有足迹的地区
            </label>
          </div>
        </>
      )}
    </section>
  );
};
