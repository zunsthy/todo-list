import { useMemo, type KeyboardEvent } from "react";
import { buildRegionTreeView } from "./tree-view.ts";
import type { Footprint, Region, TravelSnapshot } from "../types.ts";

export const RegionTree = ({
  snapshot,
  footprints,
  selectedId,
  expanded,
  query,
  visitedOnly,
  readOnly = false,
  onSelect,
  onToggle,
  onEditRegion,
  onEditFootprint,
}: {
  snapshot: TravelSnapshot;
  footprints: Footprint[];
  selectedId: string | null;
  expanded: Set<string>;
  query: string;
  visitedOnly: boolean;
  readOnly?: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onEditRegion: (region: Region) => void;
  onEditFootprint: (footprint: Footprint) => void;
}) => {
  const { tree, counts, visible, footprintsByRegion } = useMemo(
    () => buildRegionTreeView(snapshot, footprints, query, visitedOnly),
    [snapshot, footprints, query, visitedOnly],
  );
  const editHandlers = (edit: () => void) => ({
    onDoubleClick: readOnly ? undefined : edit,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "F2" && !readOnly) {
        event.preventDefault();
        edit();
      }
    },
    "aria-keyshortcuts": readOnly ? undefined : "F2",
  });
  const renderRegion = (region: Region) => {
    const children = (tree.children.get(region.id) ?? []).filter((child) =>
      visible.has(child.id),
    );
    const open = Boolean(query.trim()) || expanded.has(region.id);
    const records = footprintsByRegion.get(region.id) ?? [];
    const expandable = children.length > 0 || records.length > 0;
    return (
      <li key={region.id} data-region-id={region.id}>
        <div
          className="travel-tree-row"
          data-selected={selectedId === region.id}
        >
          {expandable ? (
            <button
              type="button"
              className="travel-tree-toggle"
              aria-expanded={open}
              aria-label={`${open ? "收起" : "展开"}${region.name}`}
              onClick={() => onToggle(region.id)}
            >
              {open ? "▾" : "▸"}
            </button>
          ) : (
            <span className="travel-tree-dot" aria-hidden="true">
              ·
            </span>
          )}
          <button
            type="button"
            className="travel-tree-select"
            title={readOnly ? "服务端控制中，编辑已禁用" : "双击编辑地区（F2）"}
            aria-current={selectedId === region.id ? "location" : undefined}
            onClick={() => onSelect(region.id)}
            {...editHandlers(() => onEditRegion(region))}
          >
            <span className="travel-tree-name">
              {region.name}
              <small>{region.id}</small>
            </span>
            <span
              className="travel-tree-count"
              data-visited={counts.has(region.id)}
            >
              {counts.get(region.id) ?? 0} 条
            </span>
          </button>
        </div>
        {open && expandable && (
          <ul>
            {records.map((footprint) => (
              <li
                key={`footprint:${footprint.id}`}
                data-footprint-id={footprint.id}
              >
                <button
                  type="button"
                  className="travel-tree-footprint"
                  disabled={readOnly}
                  aria-haspopup="dialog"
                  aria-label={`编辑足迹：${footprint.name}`}
                  title={
                    readOnly
                      ? "服务端控制中，编辑已禁用"
                      : "双击编辑足迹（Enter 或 F2）"
                  }
                  onClick={(event) => {
                    if (event.detail === 0 && !readOnly)
                      onEditFootprint(footprint);
                    else onSelect(footprint.regionId);
                  }}
                  {...editHandlers(() => onEditFootprint(footprint))}
                >
                  <span className="travel-tree-footprint-name">
                    {footprint.name}
                  </span>
                  <time>{footprint.time ?? "时间未知"}</time>
                  <span className="travel-badge">{footprint.visitType}</span>
                </button>
              </li>
            ))}
            {children.map(renderRegion)}
          </ul>
        )}
      </li>
    );
  };
  const roots = (tree.children.get(null) ?? []).filter((region) =>
    visible.has(region.id),
  );
  return (
    <nav className="travel-tree" aria-label="地区树">
      {roots.length ? (
        <ul>{roots.map(renderRegion)}</ul>
      ) : (
        <p className="empty-state">
          {snapshot.regions.length ? "没有匹配的地区。" : "暂无地区"}
        </p>
      )}
    </nav>
  );
};
