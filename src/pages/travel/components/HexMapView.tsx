import { useEffect, useMemo, useRef, useState } from "react";
import type { TravelDatabase } from "../db.ts";
import type { Region } from "../types.ts";
import { buildTree } from "../model.ts";
import type { HexMap, MapHover, MapStatus } from "../map/engine.ts";

export const HexMapView = (props: {
  database: TravelDatabase;
  regions: Region[];
  selectedId: string | null;
  query: string;
  readOnly: boolean;
  onSelect(id: string): void;
  onEdit(region: Region): void;
}) => {
  const { database, regions, selectedId, query, readOnly } = props;
  const latest = useRef(props);
  latest.current = props;
  const canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const engine = useRef<HexMap | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<MapStatus>({
    loading: true,
    visible: 0,
    missing: 0,
    scale: 1,
    error: "",
  });
  const [hover, setHover] = useState<MapHover | null>(null);
  const tree = useMemo(() => buildTree({ regions, footprints: [] }), [regions]);
  const selected = selectedId ? tree.byId.get(selectedId) : undefined;
  const hasBoundaries = regions.some((r) => r.boundaryKey);
  const locatable = useMemo(() => {
    const ids = new Set(
      regions
        .filter((r) => r.boundaryKey)
        .flatMap((r) => tree.path(r.id).map((p) => p.id)),
    );
    const search = query.trim().toLocaleLowerCase();
    return regions
      .filter(
        (r) =>
          ids.has(r.id) &&
          (!search ||
            tree
              .path(r.id)
              .some((p) =>
                [p.name, p.id, ...p.aliases].some((value) =>
                  value.toLocaleLowerCase().includes(search),
                ),
              )),
      )
      .sort((a, b) =>
        tree
          .path(a.id)
          .map((p) => p.name)
          .join("/")
          .localeCompare(
            tree
              .path(b.id)
              .map((p) => p.name)
              .join("/"),
            "zh-CN",
          ),
      );
  }, [regions, tree, query]);
  // Tooltip movement must not rebuild a potentially large location menu.
  const locationOptions = useMemo(
    () =>
      locatable.map((region) => (
        <option key={region.id} value={region.id}>
          {tree
            .path(region.id)
            .map((r) => r.name)
            .join(" / ")}{" "}
          · {region.id}
        </option>
      )),
    [locatable, tree],
  );

  useEffect(() => {
    if (!hasBoundaries) {
      setStatus((s) => ({
        ...s,
        loading: false,
        visible: 0,
        missing: 0,
        error: "",
      }));
      setHover(null);
      const element = canvas.current;
      element?.getContext("2d")?.clearRect(0, 0, element.width, element.height);
      return;
    }
    let disposed = false;
    const element = canvas.current!,
      container = stage.current!;
    const observer = new ResizeObserver(() => {
      engine.current?.resize(container.clientWidth, container.clientHeight);
    });
    observer.observe(container);
    setStatus((s) => ({ ...s, loading: true, error: "" }));
    // Keep D3, the hexgrid plugin and all geometry out of the tree-only path.
    void import("../map/engine.js")
      .then(({ createHexMap }) => {
        if (disposed) return;
        const map = createHexMap(element, {
          readBoundary: (key) => database.getBoundary(key),
          onStatus: (next) => {
            if (!disposed) setStatus(next);
          },
          onHover: (next) => {
            if (!disposed) setHover(next);
          },
          onSelect: (region) => latest.current.onSelect(region.id),
          onEdit: (region) => {
            if (!latest.current.readOnly) latest.current.onEdit(region);
          },
        });
        engine.current = map;
        map.update(latest.current.regions, latest.current.selectedId);
        map.resize(container.clientWidth, container.clientHeight);
      })
      .catch((error) => {
        if (!disposed)
          setStatus((s) => ({
            ...s,
            loading: false,
            error: `地图加载失败：${error instanceof Error ? error.message : String(error)}`,
          }));
      });
    return () => {
      disposed = true;
      observer.disconnect();
      engine.current?.destroy();
      engine.current = null;
    };
  }, [database, hasBoundaries, attempt]);

  useEffect(() => {
    engine.current?.update(regions, selectedId);
  }, [regions, selectedId]);

  return (
    <section className="travel-map-panel" aria-label="六边形边界地图">
      <div className="travel-map-toolbar">
        <div className="travel-actions">
          <button
            type="button"
            aria-label="放大地图"
            disabled={!hasBoundaries}
            onClick={() => engine.current?.zoom(1.7)}
          >
            ＋
          </button>
          <button
            type="button"
            aria-label="缩小地图"
            disabled={!hasBoundaries}
            onClick={() => engine.current?.zoom(1 / 1.7)}
          >
            −
          </button>
          <button
            type="button"
            disabled={!hasBoundaries}
            onClick={() => engine.current?.reset()}
          >
            全览
          </button>
        </div>
        <select
          aria-label="定位地图地区"
          value=""
          disabled={!locatable.length}
          onChange={(event) => {
            const id = event.target.value;
            if (id) {
              props.onSelect(id);
              setHover(null);
              void engine.current?.focus(id);
            }
          }}
        >
          <option value="">
            {query
              ? `${locatable.length} 个匹配地区，选择定位`
              : "选择地区定位…"}
          </option>
          {locationOptions}
        </select>
        {selected && (
          <div className="travel-actions">
            <button
              type="button"
              disabled={!hasBoundaries}
              onClick={() => {
                setHover(null);
                void engine.current?.focus(selected.id);
              }}
            >
              定位当前地区
            </button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => props.onEdit(selected)}
            >
              编辑地区
            </button>
          </div>
        )}
        <small className="travel-map-status" role="status">
          {status.loading
            ? "正在读取边界／生成格网…"
            : `当前 ${status.visible} 个地区`}
        </small>
      </div>
      {status.error && (
        <p className="travel-error" role="alert">
          {status.error}{" "}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            重试
          </button>
        </p>
      )}
      {status.missing > 0 && (
        <p className="travel-error">
          {status.missing} 条引用的边界未找到，已跳过。
        </p>
      )}
      <div className="travel-map-stage" ref={stage}>
        <canvas
          ref={canvas}
          className="travel-hex-map"
          tabIndex={0}
          aria-label="行政区六边形地图，可滚轮缩放、拖动平移，双击地区编辑；键盘加减号缩放，F2编辑当前地区"
          data-visible-regions={status.visible}
          data-map-scale={status.scale}
          aria-busy={status.loading}
        />
        {!hasBoundaries && (
          <p className="travel-map-empty">
            还没有可展示的边界，请先在数据管理中导入地区边界。
          </p>
        )}
        {hover && (
          <div
            className="travel-map-tooltip"
            role="tooltip"
            style={{
              left: Math.max(
                8,
                Math.min(
                  hover.x + 14,
                  (stage.current?.clientWidth ?? 320) - 285,
                ),
              ),
              top: Math.max(
                8,
                Math.min(
                  hover.y + 14,
                  (stage.current?.clientHeight ?? 500) - 90,
                ),
              ),
            }}
          >
            <strong>{hover.region.name}</strong>
            <span>
              {hover.region.kind} · {hover.region.id}
            </span>
            <span>
              {tree
                .path(hover.region.id)
                .map((r) => r.name)
                .join(" / ")}
            </span>
            <small>
              {readOnly ? "服务端控制中，编辑已禁用" : "双击编辑地区"}
            </small>
          </div>
        )}
      </div>
    </section>
  );
};
