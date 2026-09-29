import { geoClipRectangle, geoIdentity, geoPath } from "d3";
import { hexgrid, type HexLayout } from "d3-hexgrid";
import type { GeometryCollection, MultiPolygon } from "geojson";
import type { Footprint, Region } from "../types.ts";
import { projectPosition } from "./geometry.ts";
import {
  footprintColor,
  summarizeFootprints,
  type FootprintStats,
} from "./footprints.ts";
import {
  HEX_RADIUS,
  bufferedViewport,
  hexGridOffset,
  type Bounds,
  type Camera,
  type Point,
  type Size,
} from "./layout.ts";

export interface MapShape {
  region: Region;
  geometry: MultiPolygon;
  sourceGeometry?: MultiPolygon;
}
interface HitArea {
  path: Path2D;
  bounds: Bounds;
}
interface PaintedShape extends MapShape, HitArea {
  cells: Path2D;
}
interface FootprintCell {
  path: Path2D;
  region: Region;
  stats: FootprintStats;
}
export interface MapHit {
  region: Region;
  footprints: FootprintStats | null;
}

export class HexMapRenderer {
  private image = document.createElement("canvas");
  private picking = document.createElement("canvas").getContext("2d")!;
  private hitAreas = new WeakMap<MultiPolygon, HitArea>();
  private grid: HexLayout | null = null;
  private owners = new Map<string, Region>();
  private footprintCells = new Map<string, FootprintCell>();
  private footprints: { footprint: Footprint; point: Point }[] = [];
  private radius = HEX_RADIUS;
  private shapes: PaintedShape[] = [];
  private camera: Camera = { x: 0, y: 0, k: 1 };
  private size: Size = { width: 1, height: 1 };
  private renderSize: Size = { width: 1, height: 1 };
  private offset: Point = [0, 0];
  private gridOffset: Point = [0, 0];
  private rendered = false;
  private ratio = 1;
  private canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  setFootprints(footprints: Footprint[]) {
    this.footprints = footprints.flatMap((footprint) => {
      const point = footprint.pos ? projectPosition(footprint.pos) : null;
      return point ? [{ footprint, point }] : [];
    });
    // Filters only recolor the cached grid; they do not rebuild boundaries.
    if (this.rendered) this.colorCells();
  }

  render(shapes: MapShape[], camera: Camera, size: Size) {
    this.canvas.dataset.visibleRegionIds = shapes
      .map((shape) => shape.region.id)
      .join(",");
    const { width, height } = size;
    const buffer = bufferedViewport(camera, size);
    this.camera = buffer.camera;
    this.renderSize = buffer.size;
    this.offset = buffer.offset;
    const { width: renderWidth, height: renderHeight } = buffer.size;
    this.size = size;
    this.grid = null;
    this.owners.clear();
    this.ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.ratio);
    this.canvas.height = Math.round(height * this.ratio);
    this.image.width = Math.round(renderWidth * this.ratio);
    this.image.height = Math.round(renderHeight * this.ratio);
    const path = geoPath(null).digits(6);
    this.shapes = shapes.map((shape) => {
      // Independently simplified neighbors may leave subpixel seams. Assign
      // cells using the original projected geometry; cache its native path.
      const geometry = shape.sourceGeometry ?? shape.geometry;
      let hit = this.hitAreas.get(geometry);
      if (!hit) {
        hit = {
          path: new Path2D(path(geometry) ?? ""),
          bounds: path.bounds(geometry),
        };
        this.hitAreas.set(geometry, hit);
      }
      return { ...shape, ...hit, cells: new Path2D() };
    });
    if (this.shapes.length) {
      const radius = Math.max(
        HEX_RADIUS,
        Math.round(Math.sqrt((width * height) / 18000) * 2) / 2,
      );
      this.radius = radius;
      this.gridOffset = hexGridOffset(this.camera, radius);
      const [gridX, gridY] = this.gridOffset;
      const gridWidth = Math.ceil(renderWidth - gridX);
      const gridHeight = Math.ceil(renderHeight - gridY);
      const transform = geoIdentity()
        .scale(this.camera.k)
        .translate([this.camera.x - gridX, this.camera.y - gridY]);
      transform.postclip(geoClipRectangle(0, 0, gridWidth, gridHeight));
      const geography: GeometryCollection = {
        type: "GeometryCollection",
        geometries: shapes.map((s) => s.geometry),
      };
      const layout = hexgrid()
        .extent([gridWidth, gridHeight])
        .geography(geography)
        .projection(transform)
        .pathGenerator(geoPath(transform))
        .hexRadius(radius)
        .edgePrecision(0.3)([]);
      this.grid = layout;
      const cell = new Path2D(layout.hexagon(radius - 0.35));
      // Use the full lattice, not pixel-filtered centers: antialiasing can
      // otherwise omit valid cells along internal administrative borders.
      for (const [x, y] of layout.centers()) {
        // The local lattice follows the map's world origin, not the canvas.
        const bx = x + gridX,
          by = y + gridY;
        const shape = this.shapeAt(bx, by);
        if (shape) {
          this.owners.set(this.cellKey(x, y), shape.region);
          shape.cells.addPath(cell, new DOMMatrix().translate(bx, by));
        }
      }
    }
    this.colorCells();
    this.rendered = true;
    this.paint(camera);
  }

  private colorCells() {
    this.footprintCells.clear();
    const groups = new Map<
      string,
      { x: number; y: number; region: Region; footprints: Footprint[] }
    >();
    if (this.grid) {
      for (const { footprint, point } of this.footprints) {
        const x = point[0] * this.camera.k + this.camera.x,
          y = point[1] * this.camera.k + this.camera.y;
        if (
          x < -this.radius ||
          y < -this.radius ||
          x > this.renderSize.width + this.radius ||
          y > this.renderSize.height + this.radius
        )
          continue;
        // Only map actual points covered by the displayed boundary frontier.
        // A coastal point can occupy a cell whose center is outside the land;
        // keep that very same cell, without moving it to a nearby location.
        const shape = this.shapeAt(x, y);
        if (!shape) continue;
        const center = this.grid([
          { x: x - this.gridOffset[0], y: y - this.gridOffset[1] },
        ])[0];
        if (!center) continue;
        const key = this.cellKey(center.x, center.y);
        let group = groups.get(key);
        if (!group) {
          group = {
            x: center.x + this.gridOffset[0],
            y: center.y + this.gridOffset[1],
            region: this.owners.get(key) ?? shape.region,
            footprints: [],
          };
          groups.set(key, group);
        }
        group.footprints.push(footprint);
      }
      const cell = new Path2D(this.grid.hexagon(this.radius - 0.35));
      for (const [key, group] of groups) {
        const path = new Path2D();
        path.addPath(cell, new DOMMatrix().translate(group.x, group.y));
        this.footprintCells.set(key, {
          path,
          region: group.region,
          stats: summarizeFootprints(group.footprints),
        });
      }
    }
    const context = this.image.getContext("2d")!;
    context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, this.renderSize.width, this.renderSize.height);
    context.fillStyle = footprintColor();
    context.strokeStyle = "#aaa";
    context.lineWidth = 0.55;
    for (const shape of this.shapes) {
      context.fill(shape.cells);
      context.stroke(shape.cells);
    }
    for (const cell of this.footprintCells.values()) {
      context.fillStyle = footprintColor(cell.stats);
      context.fill(cell.path);
      context.stroke(cell.path);
    }
  }

  covers(camera: Camera, size: Size): boolean {
    if (!this.rendered) return false;
    const k = camera.k / this.camera.k;
    const x = camera.x - this.camera.x * k;
    const y = camera.y - this.camera.y * k;
    const margin = Math.min(16, size.width * 0.04, size.height * 0.04);
    return (
      x <= -margin &&
      y <= -margin &&
      x + this.renderSize.width * k >= size.width + margin &&
      y + this.renderSize.height * k >= size.height + margin
    );
  }

  paint(camera: Camera, highlightedId?: string | null) {
    const context = this.canvas.getContext("2d")!;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const k = camera.k / this.camera.k;
    const x = camera.x - this.camera.x * k,
      y = camera.y - this.camera.y * k;
    context.setTransform(
      this.ratio * k,
      0,
      0,
      this.ratio * k,
      this.ratio * x,
      this.ratio * y,
    );
    context.drawImage(
      this.image,
      0,
      0,
      this.renderSize.width,
      this.renderSize.height,
    );
    if (highlightedId) {
      context.strokeStyle = "#666";
      context.lineWidth = 1 / k;
      const shape = this.shapes.find((s) => s.region.id === highlightedId);
      if (shape) context.stroke(shape.cells);
      for (const cell of this.footprintCells.values())
        if (cell.region.id === highlightedId) context.stroke(cell.path);
    }
  }

  private shapeAt(x: number, y: number): PaintedShape | undefined {
    const px = (x - this.camera.x) / this.camera.k;
    const py = (y - this.camera.y) / this.camera.k;
    // Geometry checks happen only when rebuilding the grid. No RGB IDs or
    // alpha thresholds: a blended border pixel cannot invent another region.
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const shape = this.shapes[i]!;
      const [min, max] = shape.bounds;
      if (
        px >= min[0] &&
        px <= max[0] &&
        py >= min[1] &&
        py <= max[1] &&
        this.picking.isPointInPath(shape.path, px, py, "evenodd")
      )
        return shape;
    }
  }

  private cellKey(x: number, y: number): string {
    const row = Math.round(y / (this.radius * 1.5));
    const column = Math.round(x / (this.radius * Math.sqrt(3)) - (row & 1) / 2);
    return `${column}:${row}`;
  }

  pick(x: number, y: number): MapHit | undefined {
    if (
      !this.grid ||
      x < 0 ||
      y < 0 ||
      x >= this.size.width ||
      y >= this.size.height
    )
      return;
    // Reuse the grid's own binning so display, hover and double-click always
    // agree on the cell owner, even where a hexagon crosses a real boundary.
    const center = this.grid([
      {
        x: x + this.offset[0] - this.gridOffset[0],
        y: y + this.offset[1] - this.gridOffset[1],
      },
    ])[0];
    if (!center) return;
    const key = this.cellKey(center.x, center.y);
    const cell = this.footprintCells.get(key);
    const region = this.owners.get(key) ?? cell?.region;
    return region ? { region, footprints: cell?.stats ?? null } : undefined;
  }
}
