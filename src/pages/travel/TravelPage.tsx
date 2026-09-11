import { useMemo, useState } from "react";
import { buildTree, filterFootprints } from "./model.ts";
import { useTravelData } from "./hooks/useTravelData.js";
import type { TravelEditor } from "./components/DataManager.js";
import { EditorPanel } from "./components/EditorPanel.js";
import { Overview } from "./components/Overview.js";
import { RegionTree } from "./components/RegionTree.js";

export default function TravelPage() {
  const data = useTravelData();
  const { snapshot, ready, error } = data;
  const [selection, setSelection] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(new Set(["CN"]));
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [visitType, setVisitType] = useState("");
  const [visitedOnly, setVisitedOnly] = useState(false);
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

  return (
    <main className="travel-page" aria-label="足迹">
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
          />
          <section className="travel-tree-panel" aria-label="地区与足迹">
            <RegionTree
              snapshot={snapshot}
              footprints={footprints}
              selectedId={selectedId}
              expanded={expanded}
              query={query}
              visitedOnly={visitedOnly}
              onSelect={select}
              onToggle={toggle}
              onEditFootprint={(footprint) => {
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
        </>
      )}
      <EditorPanel
        data={data}
        selectedId={selectedId}
        editor={editor}
        onSelect={select}
        onEditorChange={setEditor}
      />
    </main>
  );
}
