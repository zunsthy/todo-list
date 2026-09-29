import { useMemo, useState } from "react";
import { buildTree } from "../model.ts";
import type { Footprint, Region, TravelSnapshot } from "../types.ts";

export type TravelEditor =
  | { kind: "region"; region: Region | null; parentId: string | null }
  | { kind: "footprint"; footprint: Footprint | null; regionId: string }
  | { kind: "import"; parentId: string | null }
  | { kind: "delete-region"; region: Region }
  | { kind: "delete-footprint"; footprint: Footprint };

export const DataManager = ({
  snapshot,
  selectedId,
  busy,
  readOnly = false,
  onSelect,
  onEdit,
  onExport,
}: {
  snapshot: TravelSnapshot;
  selectedId: string | null;
  busy: boolean;
  readOnly?: boolean;
  onSelect: (id: string) => void;
  onEdit: (editor: TravelEditor) => void;
  onExport: (regionId?: string) => void;
}) => {
  const writeDisabled = busy || readOnly;
  const tree = useMemo(() => buildTree(snapshot), [snapshot]);
  const [includeChildren, setIncludeChildren] = useState(true);
  const selected = selectedId ? tree.byId.get(selectedId) : undefined;
  const regionOptions = useMemo(() => {
    const result: Region[] = [];
    const visit = (parentId: string | null) => {
      for (const region of tree.children.get(parentId) ?? []) {
        result.push(region);
        visit(region.id);
      }
    };
    visit(null);
    return result;
  }, [tree]);
  const records = snapshot.footprints
    .filter(
      (footprint) =>
        selectedId &&
        (footprint.regionId === selectedId ||
          (includeChildren &&
            tree
              .path(footprint.regionId)
              .some((region) => region.id === selectedId))),
    )
    .sort(
      (a, b) =>
        (b.time ?? "").localeCompare(a.time ?? "") ||
        a.name.localeCompare(b.name, "zh-CN"),
    );
  return (
    <section className="travel-manager" aria-label="足迹数据管理">
      <div className="travel-actions travel-manager-toolbar">
        <button
          type="button"
          disabled={writeDisabled}
          onClick={() =>
            onEdit({ kind: "region", region: null, parentId: null })
          }
        >
          添加国家
        </button>
        <button
          type="button"
          disabled={writeDisabled}
          onClick={() => onEdit({ kind: "import", parentId: null })}
        >
          导入备份
        </button>
        <button type="button" disabled={busy} onClick={() => onExport()}>
          导出备份
        </button>
      </div>
      <label className="travel-manager-region">
        当前地区
        <select
          value={selectedId ?? ""}
          disabled={busy || !regionOptions.length}
          onChange={(event) => onSelect(event.target.value)}
        >
          {!regionOptions.length && <option value="">暂无地区</option>}
          {regionOptions.map((region) => (
            <option value={region.id} key={region.id}>
              {tree
                .path(region.id)
                .map((item) => item.name)
                .join(" / ")}{" "}
              · {region.id}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <>
          <div className="travel-actions travel-region-actions">
            <button
              type="button"
              className="primary"
              disabled={writeDisabled}
              onClick={() =>
                onEdit({
                  kind: "footprint",
                  footprint: null,
                  regionId: selected.id,
                })
              }
            >
              添加足迹
            </button>
            <button
              type="button"
              disabled={writeDisabled}
              onClick={() =>
                onEdit({ kind: "region", region: null, parentId: selected.id })
              }
            >
              添加下级
            </button>
            <button
              type="button"
              disabled={writeDisabled}
              onClick={() => onEdit({ kind: "import", parentId: selected.id })}
            >
              导入下级
            </button>
            <button
              type="button"
              disabled={writeDisabled}
              onClick={() =>
                onEdit({
                  kind: "region",
                  region: selected,
                  parentId: selected.parentId,
                })
              }
            >
              编辑地区
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onExport(selected.id)}
            >
              导出分支
            </button>
            <button
              type="button"
              className="danger"
              disabled={
                writeDisabled ||
                !tree.isLeaf(selected.id) ||
                snapshot.footprints.some(
                  (footprint) => footprint.regionId === selected.id,
                )
              }
              onClick={() =>
                onEdit({ kind: "delete-region", region: selected })
              }
            >
              删除地区
            </button>
          </div>
          <div className="travel-list-heading">
            <h3>
              足迹 <span>{records.length}</span>
            </h3>
            <label className="travel-checkbox">
              <input
                type="checkbox"
                checked={includeChildren}
                onChange={(event) => setIncludeChildren(event.target.checked)}
              />
              包含下级地区
            </label>
          </div>
          {records.length ? (
            <ul className="travel-footprint-list">
              {records.map((footprint) => (
                <li key={footprint.id} data-footprint-id={footprint.id}>
                  <div className="travel-footprint-heading">
                    <div>
                      <h4>{footprint.name}</h4>
                      <p>
                        <time>
                          {footprint.time?.replace("T", " ") ?? "时间未知"}
                        </time>
                        <span className="travel-badge">
                          {footprint.visitType}
                        </span>
                      </p>
                    </div>
                    <div className="travel-actions">
                      <button
                        type="button"
                        disabled={writeDisabled}
                        aria-label={`编辑足迹：${footprint.name}`}
                        onClick={() =>
                          onEdit({
                            kind: "footprint",
                            footprint,
                            regionId: footprint.regionId,
                          })
                        }
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={writeDisabled}
                        aria-label={`删除足迹：${footprint.name}`}
                        onClick={() =>
                          onEdit({ kind: "delete-footprint", footprint })
                        }
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="travel-path-link"
                    onClick={() => onSelect(footprint.regionId)}
                  >
                    {tree
                      .path(footprint.regionId)
                      .map((region) => region.name)
                      .join(" / ")}
                  </button>
                  {footprint.notes && (
                    <p className="travel-notes">{footprint.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">暂无足迹</p>
          )}
        </>
      )}
    </section>
  );
};
