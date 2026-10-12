import { select, zoom, zoomIdentity, type D3ZoomEvent } from "d3";
import { buildTree } from "../model.ts";
import type { Footprint, Region, RegionBoundary } from "../types.ts";
import {
  prepareBoundary,
  displayGeometry,
  type PreparedBoundary,
} from "./geometry.ts";
import {
  boundaryFrontier,
  bufferedViewport,
  fitBounds,
  inViewport,
  visibleRegions,
  type Bounds,
  type Size,
} from "./layout.ts";
import { HexMapRenderer, type MapHit } from "./renderer.ts";
import {
  limitMapZoom,
  mapScaleBar,
  maxMapZoom,
  type MapScaleBar,
} from "./scale.ts";

export interface MapStatus {
  loading: boolean;
  visible: number;
  missing: number;
  scale: number;
  scaleBar: MapScaleBar | null;
  canZoomIn: boolean;
  error: string;
}
export interface MapHover extends MapHit {
  x: number;
  y: number;
}
export interface MapOptions {
  readBoundary(key: string): Promise<RegionBoundary | undefined>;
  onStatus(status: MapStatus): void;
  onHover(hover: MapHover | null): void;
  onSelect(region: Region): void;
  onEdit(region: Region): void;
}

export const createHexMap = (
  canvas: HTMLCanvasElement,
  options: MapOptions,
) => {
  let regions: Region[] = [],
    footprints: Footprint[] = [],
    tree = buildTree({ regions, footprints: [] });
  let size: Size = { width: 1, height: 1 },
    camera = zoomIdentity;
  let destroyed = false,
    initialized = false,
    moving = false,
    changed = false,
    sequence = 0;
  let selectedId: string | null = null,
    hoveredId: string | null = null;
  let frame = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  let status: MapStatus = {
    loading: true,
    visible: 0,
    missing: 0,
    scale: 1,
    scaleBar: null,
    canZoomIn: true,
    error: "",
  };
  const cache = new Map<string, PreparedBoundary>();
  const pending = new Map<string, Promise<void>>(),
    missing = new Set<string>();
  const renderer = new HexMapRenderer(canvas);
  const announce = (changes: Partial<MapStatus>) => {
    status = {
      ...status,
      ...changes,
      scale: camera.k,
      scaleBar: initialized && cache.size ? mapScaleBar(camera, size) : null,
      canZoomIn: camera.k < maxMapZoom(camera, size) * (1 - 1e-9),
      missing: missing.size,
    };
    if (!destroyed) options.onStatus(status);
  };
  const clearHover = () => {
    hoveredId = null;
    options.onHover(null);
  };
  const paint = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!destroyed) renderer.paint(camera, moving ? null : hoveredId);
    });
  };
  const load = async (keys: string[]) => {
    let index = 0;
    const worker = async () => {
      while (index < keys.length && !destroyed) {
        const key = keys[index++]!;
        if (cache.has(key) || missing.has(key)) continue;
        if (!pending.has(key)) {
          const task = (async () => {
            const boundary = await options.readBoundary(key);
            if (destroyed) return;
            if (!boundary) {
              missing.add(key);
              return;
            }
            cache.set(key, prepareBoundary(boundary));
            // Large original geometries are prepared once, without blocking a
            // whole batch of district reads behind a single long render task.
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          })().finally(() => pending.delete(key));
          pending.set(key, task);
        }
        await pending.get(key);
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
  };
  const boundsFor = (ids: Region[]): Bounds | null => {
    const shapes = ids.flatMap((r) =>
      r.boundaryKey && cache.has(r.boundaryKey)
        ? [cache.get(r.boundaryKey)!]
        : [],
    );
    if (!shapes.length) return null;
    return [
      [
        Math.min(...shapes.map((s) => s.bounds[0][0])),
        Math.min(...shapes.map((s) => s.bounds[0][1])),
      ],
      [
        Math.max(...shapes.map((s) => s.bounds[1][0])),
        Math.max(...shapes.map((s) => s.bounds[1][1])),
      ],
    ];
  };
  const setCamera = (next: { x: number; y: number; k: number }) => {
    const limited = limitMapZoom(next, size);
    select(canvas).call(
      behavior.transform,
      zoomIdentity.translate(limited.x, limited.y).scale(limited.k),
    );
    // Repeated focus/reset can keep the same transform, but still needs to
    // finish the pending boundary load and clear its loading state.
    schedule();
  };

  const refresh = async () => {
    if (destroyed || size.width < 2 || !regions.length) return;
    const token = ++sequence;
    announce({ loading: true, error: "" });
    try {
      if (!initialized) {
        const base = boundaryFrontier(regions);
        await load(base.map((r) => r.boundaryKey!));
        if (token !== sequence || destroyed) return;
        const bounds = boundsFor(base);
        initialized = true;
        if (bounds) {
          setCamera(fitBounds(bounds, size));
          return;
        }
      }
      const buffer = bufferedViewport(camera, size);
      const gather = () =>
        visibleRegions(regions, cache, buffer.camera, buffer.size, missing);
      let view = gather();
      while (view.needed.length) {
        await load(view.needed);
        if (token !== sequence || destroyed) return;
        view = gather();
      }
      if (token !== sequence || destroyed) return;
      renderer.render(
        view.visible.map((region) => {
          const boundary = cache.get(region.boundaryKey!)!;
          return {
            region,
            geometry: displayGeometry(boundary, camera.k),
            sourceGeometry: boundary.geometry,
          };
        }),
        camera,
        size,
      );
      announce({
        loading: false,
        visible: view.visible.filter((region) =>
          inViewport(cache.get(region.boundaryKey!)!.bounds, camera, size),
        ).length,
      });
      paint();
      // Keep a bounded working set. Detail selection still needs the current
      // view's ancestors, even though those ancestors are no longer drawn.
      const protectedKeys = new Set(
        [
          ...boundaryFrontier(regions),
          ...view.visible.flatMap((r) => tree.path(r.id)),
        ].map((r) => r.boundaryKey),
      );
      for (const key of cache.keys()) {
        if (cache.size <= 160) break;
        if (!protectedKeys.has(key)) cache.delete(key);
      }
    } catch (error) {
      if (!destroyed && token === sequence)
        announce({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void refresh();
    }, 90);
  };
  const behavior = zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.1, maxMapZoom(camera, size)])
    .clickDistance(4)
    .filter(
      (event) =>
        event.type !== "dblclick" &&
        (!event.ctrlKey || event.type === "wheel") &&
        !event.button,
    )
    .on("start", () => {
      moving = true;
      changed = false;
      clearHover();
    })
    .on("zoom", (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
      const cameraChanged =
        camera.x !== event.transform.x ||
        camera.y !== event.transform.y ||
        camera.k !== event.transform.k;
      camera = event.transform;
      // Latitude changes the next zoom limit, but panning must not itself
      // zoom out or rebuild the map at a different geographic resolution.
      behavior.scaleExtent([0.1, Math.max(camera.k, maxMapZoom(camera, size))]);
      if (cameraChanged) {
        changed = true;
        sequence++;
        announce({ loading: true });
      }
      paint();
      // Refill the overscan before it runs out, even during a long gesture.
      if (!renderer.covers(camera, size) && timer === undefined) schedule();
    })
    .on("end", () => {
      moving = false;
      if (changed) schedule();
      else paint();
    });
  select(canvas).call(behavior).on("dblclick.zoom", null);
  const point = (event: MouseEvent) => {
    const bounds = canvas.getBoundingClientRect();
    return [event.clientX - bounds.left, event.clientY - bounds.top] as const;
  };
  const hover = (event: MouseEvent) => {
    if (moving || status.loading) return;
    const [x, y] = point(event),
      hit = renderer.pick(x, y);
    const nextId = hit?.region.id ?? null;
    const regionChanged = hoveredId !== nextId;
    hoveredId = nextId;
    canvas.style.cursor = hit ? "pointer" : "grab";
    options.onHover(hit ? { ...hit, x, y } : null);
    if (regionChanged) paint();
  };
  const leave = () => {
    clearHover();
    paint();
  };
  const click = (event: MouseEvent) => {
    if (moving || status.loading) return;
    const region = renderer.pick(...point(event))?.region;
    if (region) options.onSelect(region);
  };
  const edit = (event: MouseEvent) => {
    event.preventDefault();
    if (moving || status.loading) return;
    const region = renderer.pick(...point(event))?.region;
    if (region) options.onEdit(region);
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      event.preventDefault();
      select(canvas).call(behavior.scaleBy, event.key === "-" ? 1 / 1.6 : 1.6);
    } else if (event.key === "F2" && selectedId) {
      const region = tree.byId.get(selectedId);
      if (region) {
        event.preventDefault();
        options.onEdit(region);
      }
    }
  };
  canvas.addEventListener("mousemove", hover);
  canvas.addEventListener("mouseleave", leave);
  canvas.addEventListener("click", click);
  canvas.addEventListener("dblclick", edit);
  canvas.addEventListener("keydown", keydown);

  return {
    update(
      nextRegions: Region[],
      selected: string | null,
      nextFootprints: Footprint[],
    ) {
      selectedId = selected;
      if (footprints !== nextFootprints) {
        footprints = nextFootprints;
        clearHover();
        renderer.setFootprints(footprints);
      }
      if (regions !== nextRegions) {
        sequence++;
        clearHover();
        regions = nextRegions;
        tree = buildTree({ regions, footprints: [] });
        const keys = new Set(regions.map((r) => r.boundaryKey));
        for (const key of cache.keys()) if (!keys.has(key)) cache.delete(key);
        for (const key of missing) if (!keys.has(key)) missing.delete(key);
        schedule();
      } else paint();
    },
    resize(width: number, height: number) {
      const next = {
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      };
      if (next.width === size.width && next.height === size.height) return;
      const old = size;
      size = next;
      behavior.extent([
        [0, 0],
        [size.width, size.height],
      ]);
      if (initialized)
        setCamera({
          x: camera.x + (size.width - old.width) / 2,
          y: camera.y + (size.height - old.height) / 2,
          k: camera.k,
        });
      else schedule();
    },
    zoom(factor: number) {
      select(canvas).call(behavior.scaleBy, factor);
    },
    reset() {
      sequence++;
      initialized = false;
      missing.clear();
      clearHover();
      schedule();
    },
    async focus(id: string) {
      if (!tree.byId.has(id)) return;
      clearTimeout(timer);
      timer = undefined;
      const token = ++sequence;
      clearHover();
      const targets = boundaryFrontier(regions, id);
      announce({ loading: true });
      try {
        await load(targets.map((r) => r.boundaryKey!));
        if (destroyed || token !== sequence) return;
        const bounds = boundsFor(targets);
        if (bounds) {
          initialized = true;
          setCamera(fitBounds(bounds, size));
        } else
          announce({ loading: false, error: "这个地区及其下级还没有可用边界" });
      } catch (error) {
        if (!destroyed && token === sequence)
          announce({ loading: false, error: String(error) });
      }
    },
    destroy() {
      destroyed = true;
      sequence++;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      select(canvas).on(".zoom", null);
      canvas.removeEventListener("mousemove", hover);
      canvas.removeEventListener("mouseleave", leave);
      canvas.removeEventListener("click", click);
      canvas.removeEventListener("dblclick", edit);
      canvas.removeEventListener("keydown", keydown);
      cache.clear();
    },
  };
};

export type HexMap = ReturnType<typeof createHexMap>;
