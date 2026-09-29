import { useMemo, useState } from "react";
import { buildTree, filterFootprints } from "./model.ts";
import { useTravelData } from "./hooks/useTravelData.js";
import type { TravelEditor } from "./components/DataManager.js";
import { EditorPanel } from "./components/EditorPanel.js";
import { Overview } from "./components/Overview.js";
import { RegionTree } from "./components/RegionTree.js";
import { useTravelBridge } from "./bridge/useTravelBridge.ts";
import { BridgeBanner } from "../../shared/bridge/Control.tsx";
import { HexMapView } from "./components/HexMapView.js";
import type { Region } from "./types.ts";

export default function TravelPage() {
  const data = useTravelData();
  const bridge = useTravelBridge(data);
  const { snapshot, ready, error } = data;
  const [selection, setSelection] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(new Set(["CN"]));
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [visitType, setVisitType] = useState("");
  const [visitedOnly, setVisitedOnly] = useState(false);
  const [view, setView] = useState<"tree" | "map">("tree");
  const [editor, setEditor] = useState<TravelEditor | null>(null);
  const tree = useMemo(() => buildTree(snapshot), [snapshot]);
  const selectedId =
    selection && tree.byId.has(selection)
      ? selection
      : (tree.children.get(null)?.[0]?.id ?? null);
  const footprints = useMemo(
    () => filterFootprints(snapshot.footprints, year, visitType),
    [snapshot.footprints, year, visitType],
  );
  const countriesVisited = new Set(
    footprints.map((footprint) => tree.path(footprint.regionId)[0]?.id),
  ).size;
  const select = (id: string) => {
    setSelection(id);
    setExpanded(
      (current) =>
        new Set([...current, ...tree.path(id).map((region) => region.id), id]),
    );
  };
  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const editRegion = (region: Region) => {
    if (bridge.enabled) return;
    data.clearFeedback();
    select(region.id);
    setEditor({ kind: "region", region, parentId: region.parentId });
  };

  return (
    <main className="travel-page" data-view={view} aria-label="足迹">
      <BridgeBanner bridge={bridge} />
      {error && !editor && (
        <p className="travel-error" role="alert">
          {error}{" "}
          {!ready && (
            <button type="button" onClick={() => location.reload()}>
              重新加载
            </button>
          )}
        </p>
      )}
      {!ready ? (
        <p className="empty-state" role="status">
          {error ? "暂时无法读取足迹数据。" : "正在读取足迹…"}
        </p>
      ) : (
        <>
          <Overview
            footprints={snapshot.footprints}
            filteredFootprints={footprints}
            countriesVisited={countriesVisited}
            query={query}
            year={year}
            visitType={visitType}
            visitedOnly={visitedOnly}
            onQueryChange={setQuery}
            onYearChange={setYear}
            onVisitTypeChange={setVisitType}
            onVisitedOnlyChange={setVisitedOnly}
            view={view}
            onViewChange={setView}
          />
          {view === "map" && data.database ? (
            <HexMapView
              database={data.database}
              regions={snapshot.regions}
              footprints={footprints}
              selectedId={selectedId}
              query={query}
              readOnly={bridge.enabled}
              onSelect={select}
              onEdit={editRegion}
            />
          ) : (
            <section className="travel-tree-panel" aria-label="地区与足迹">
              <RegionTree
                snapshot={snapshot}
                footprints={footprints}
                selectedId={selectedId}
                expanded={expanded}
                query={query}
                visitedOnly={visitedOnly}
                readOnly={bridge.enabled}
                onSelect={select}
                onToggle={toggle}
                onEditRegion={editRegion}
                onEditFootprint={(footprint) => {
                  if (bridge.enabled) return;
                  data.clearFeedback();
                  select(footprint.regionId);
                  setEditor({
                    kind: "footprint",
                    footprint,
                    regionId: footprint.regionId,
                  });
                }}
              />
            </section>
          )}
        </>
      )}
      <EditorPanel
        data={data}
        bridge={bridge}
        selectedId={selectedId}
        editor={editor}
        onSelect={select}
        onEditorChange={setEditor}
      />
    </main>
  );
}
