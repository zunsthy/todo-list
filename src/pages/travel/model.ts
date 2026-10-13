import { coordinateSystems, visitTypes } from "./types.ts";
import type {
  Footprint,
  FootprintExport,
  ImportChange,
  ImportPlan,
  LngLat,
  Pos,
  Region,
  RegionBoundary,
  TravelData,
  TravelSnapshot,
} from "./types.ts";

export const emptySnapshot = (): TravelSnapshot => ({
  regions: [],
  footprints: [],
});
export const chinaRegion = (): Region => ({
  id: "CN",
  parentId: null,
  name: "中国",
  aliases: [],
  kind: "国家",
  classification: "administrative",
  sortOrder: 0,
  notes: "",
  pos: null,
  boundaryKey: null,
  state: "unloaded",
});
const fail = (message: string): never => {
  throw new Error(message);
};
const object = (value: unknown, label: string): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail(`${label}必须是对象`);
const fields = (
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
): void => {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) fail(`${label}包含不支持的字段：${extra.join("、")}`);
};
const string = (value: unknown, label: string, empty = false): string => {
  if (typeof value !== "string" || (!empty && !value.trim()))
    fail(`${label}不能为空且必须是字符串`);
  return value as string;
};
const id = (value: unknown, label: string): string => {
  const result = string(value, label);
  if (result !== result.trim() || /\s/.test(result))
    fail(`${label}不能包含空白字符`);
  return result;
};
const array = (value: unknown, label: string): unknown[] =>
  Array.isArray(value) ? value : fail(`${label}必须是数组`);
const choice = <T extends string>(
  value: unknown,
  choices: readonly T[],
  label: string,
): T =>
  choices.includes(value as T)
    ? (value as T)
    : fail(`${label}必须是 ${choices.join(" / ")} 之一`);
const finite = (value: unknown, label: string): number =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : fail(`${label}必须是有限数值`);
const timestamp = (value: unknown, label: string): string => {
  const text = string(value, label);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(text) ||
    !Number.isFinite(Date.parse(text))
  )
    fail(`${label}必须是 UTC ISO 时间`);
  parseTime(text.slice(0, 10));
  return text;
};
const lngLat = (value: unknown): LngLat => {
  const coordinates = array(value, "坐标");
  if (coordinates.length !== 2) fail("坐标必须按经度、纬度顺序提供两个数值");
  const longitude = finite(coordinates[0], "经度"),
    latitude = finite(coordinates[1], "纬度");
  if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90)
    fail("经度范围为 -180～180，纬度范围为 -90～90");
  return [longitude, latitude];
};
export const parsePos = (value: unknown): Pos | null => {
  if (value === null) return null;
  const data = object(value, "位置（坐标和坐标系需同时填写）");
  fields(data, ["coordinates", "coordinateSystem"], "位置");
  return {
    coordinates: lngLat(data.coordinates),
    coordinateSystem: choice(
      data.coordinateSystem,
      coordinateSystems,
      "坐标系",
    ),
  };
};
export const parseTime = (value: unknown): string | null => {
  if (value === null) return null;
  const text = string(value, "时间");
  const match =
    /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:[T ](\d{2}):(\d{2}))?)?)?$/.exec(text);
  if (!match)
    return fail("时间请填写年、月、日或 YYYY-MM-DD HH:mm，未知可留空");
  const year = Number(match[1]),
    month = Number(match[2] ?? 1),
    day = Number(match[3] ?? 1);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]!)
    fail("时间不是有效的日历日期");
  if (
    match[4] !== undefined &&
    (Number(match[4]) > 23 || Number(match[5]) > 59)
  )
    fail("时间的小时须为 00～23，分钟须为 00～59");
  // Local wall time; do not invent a timezone or shift the calendar date.
  return text.replace(" ", "T");
};
export const parseRegion = (value: unknown): Region => {
  const data = object(value, "地区");
  fields(
    data,
    [
      "id",
      "parentId",
      "name",
      "aliases",
      "kind",
      "classification",
      "sortOrder",
      "notes",
      "pos",
      "boundaryKey",
      "state",
      "importedAt",
    ],
    "地区",
  );
  const sortOrder = finite(data.sortOrder, "排序");
  if (!Number.isInteger(sortOrder) || sortOrder < 0) fail("排序必须是非负整数");
  return {
    id: id(data.id, "地区编码"),
    parentId: data.parentId === null ? null : id(data.parentId, "父级编码"),
    name: string(data.name, "地区名称").trim(),
    aliases: array(data.aliases, "别名").map((value) =>
      string(value, "别名").trim(),
    ),
    kind: string(data.kind, "地区级别").trim(),
    classification: choice(
      data.classification,
      ["administrative", "functional", "custom"],
      "地区类别",
    ),
    sortOrder,
    notes: string(data.notes, "地区说明", true),
    pos: parsePos(data.pos),
    boundaryKey:
      data.boundaryKey === null ? null : id(data.boundaryKey, "边界 key"),
    state: choice(data.state, ["unloaded", "partial", "complete"], "导入状态"),
    ...(data.importedAt === undefined
      ? {}
      : { importedAt: timestamp(data.importedAt, "导入时间") }),
  };
};
export const parseFootprint = (value: unknown): Footprint => {
  const data = object(value, "足迹");
  fields(
    data,
    ["id", "time", "regionId", "name", "visitType", "notes", "pos"],
    "足迹",
  );
  return {
    id: id(data.id, "足迹 ID"),
    time: parseTime(data.time),
    regionId: id(data.regionId, "地区编码"),
    name: string(data.name, "足迹名称").trim(),
    visitType: choice(data.visitType, visitTypes, "到访方式"),
    notes: string(data.notes, "足迹说明", true),
    pos: parsePos(data.pos),
  };
};
const polygon = (value: unknown): LngLat[][] => {
  const rings = array(value, "多边形");
  if (!rings.length) fail("多边形至少包含一个闭合环");
  return rings.map((value) => {
    const points = array(value, "边界环").map(lngLat);
    if (
      points.length < 4 ||
      !same(points[0], points[points.length - 1]) ||
      new Set(points.map((point) => JSON.stringify(point))).size < 3
    )
      fail("边界环至少需要三个不同点和一个相同的首尾闭合点");
    return points;
  });
};
export const parseBoundary = (value: unknown): RegionBoundary => {
  const data = object(value, "边界");
  fields(data, ["key", "coordinateSystem", "geometry"], "边界");
  const geometry = object(data.geometry, "边界几何");
  fields(geometry, ["type", "coordinates"], "边界几何");
  const type = choice(geometry.type, ["Polygon", "MultiPolygon"], "边界类型");
  const result: RegionBoundary = {
    key: id(data.key, "边界 key"),
    coordinateSystem: choice(
      data.coordinateSystem,
      coordinateSystems,
      "边界坐标系",
    ),
    geometry:
      type === "Polygon"
        ? { type, coordinates: polygon(geometry.coordinates) }
        : {
            type,
            coordinates: array(geometry.coordinates, "多片边界").map(polygon),
          },
  };
  if (!result.geometry.coordinates.length) fail("边界不能为空");
  return result;
};
export const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => same(value, b[index]))
    );
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left).sort(),
    rightKeys = Object.keys(right).sort();
  return (
    same(leftKeys, rightKeys) &&
    leftKeys.every((key) => same(left[key], right[key]))
  );
};
// IndexedDB returns fresh objects even when a focus refresh found no changes.
// Retain unchanged branches so read-only refreshes do not rebuild the map.
export const retainSnapshot = (
  previous: TravelSnapshot,
  next: TravelSnapshot,
): TravelSnapshot => {
  const regions = same(previous.regions, next.regions)
    ? previous.regions
    : next.regions;
  const footprints = same(previous.footprints, next.footprints)
    ? previous.footprints
    : next.footprints;
  return regions === previous.regions && footprints === previous.footprints
    ? previous
    : { regions, footprints };
};

const unique = <T>(
  items: T[],
  getId: (item: T) => string,
  label: string,
): Map<string, T> => {
  const result = new Map<string, T>();
  for (const item of items) {
    const key = getId(item);
    if (result.has(key)) fail(`${label}重复：${key}`);
    result.set(key, item);
  }
  return result;
};
export const buildTree = (snapshot: TravelSnapshot) => {
  const byId = new Map(snapshot.regions.map((region) => [region.id, region]));
  const children = new Map<string | null, Region[]>();
  for (const region of snapshot.regions) {
    const siblings = children.get(region.parentId) ?? [];
    siblings.push(region);
    children.set(region.parentId, siblings);
  }
  for (const siblings of children.values())
    siblings.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
  const path = (regionId: string): Region[] => {
    const result: Region[] = [],
      seen = new Set<string>();
    let current = byId.get(regionId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      result.unshift(current);
      current =
        current.parentId === null ? undefined : byId.get(current.parentId);
    }
    return result;
  };
  return {
    byId,
    children,
    path,
    isLeaf: (regionId: string) => !children.get(regionId)?.length,
  };
};
export const validateSnapshot = (
  snapshot: TravelSnapshot,
  boundaryKeys: Set<string>,
): void => {
  const regions = unique(snapshot.regions, (region) => region.id, "地区编码");
  unique(snapshot.footprints, (footprint) => footprint.id, "足迹 ID");
  const tree = buildTree(snapshot);
  for (const region of regions.values()) {
    let current = region;
    const seen = new Set<string>();
    while (current.parentId !== null) {
      if (seen.has(current.id)) fail(`地区树存在循环：${region.id}`);
      seen.add(current.id);
      current =
        regions.get(current.parentId) ??
        fail(`父地区不存在：${current.parentId}`);
    }
    if (!/^[A-Z]{2}$/.test(current.id) || current.kind !== "国家")
      fail("根节点必须是国家，编码使用两位大写国家代码");
    if (region.parentId !== null) {
      const customPrefix = `custom:${current.id}:`;
      const valid =
        (region.id.startsWith(customPrefix) &&
          region.id.length > customPrefix.length) ||
        (current.id === "CN"
          ? /^\d{6}$/.test(region.id)
          : region.id.startsWith(`${current.id}-`) && region.id.length > 3);
      if (!valid || region.kind === "国家")
        fail(`地区编码或级别与所属国家不符：${region.id}`);
    }
    if (region.state === "unloaded" && !tree.isLeaf(region.id))
      fail(`已有下级的地区不能标为 unloaded：${region.id}`);
    if (region.boundaryKey !== null && !boundaryKeys.has(region.boundaryKey))
      fail(`边界不存在：${region.boundaryKey}`);
  }
  for (const footprint of snapshot.footprints)
    if (!regions.has(footprint.regionId))
      fail(`足迹引用的地区不存在：${footprint.regionId}`);
};
export const parseBackup = (value: unknown): FootprintExport => {
  const envelope = object(value, "备份");
  fields(envelope, ["format", "version", "exportedAt", "data"], "备份");
  if (envelope.format !== "todo-list-footprints" || envelope.version !== 1)
    fail("请选择 version 为 1 的 todo-list-footprints 备份");
  const data = object(envelope.data, "备份数据");
  fields(data, ["regions", "footprints", "regionBoundaries"], "备份数据");
  const result: FootprintExport = {
    format: "todo-list-footprints",
    version: 1,
    exportedAt: timestamp(envelope.exportedAt, "导出时间"),
    data: {
      regions: array(data.regions, "地区").map(parseRegion),
      footprints: array(data.footprints, "足迹").map(parseFootprint),
      regionBoundaries: array(data.regionBoundaries, "边界").map(parseBoundary),
    },
  };
  const boundaries = unique(
    result.data.regionBoundaries,
    (boundary) => boundary.key,
    "边界 key",
  );
  validateSnapshot(result.data, new Set(boundaries.keys()));
  return result;
};

export const planImport = (
  existing: TravelData,
  value: unknown,
  parentId: string | null,
  now: string,
): ImportPlan => {
  const data = structuredClone(existing),
    changes: ImportChange[] = [],
    warnings: string[] = [];
  const regions = new Map(data.regions.map((region) => [region.id, region]));
  const footprints = new Map(
    data.footprints.map((footprint) => [footprint.id, footprint]),
  );
  const boundaries = new Map(
    data.regionBoundaries.map((boundary) => [boundary.key, boundary]),
  );
  const oldTree = buildTree(existing);
  const oldFootprints = new Map(
    existing.footprints.map((footprint) => [footprint.id, footprint]),
  );
  const oldBoundaries = new Map(
    existing.regionBoundaries.map((boundary) => [boundary.key, boundary]),
  );
  const mergeBoundaries = (incoming: RegionBoundary[]) => {
    unique(incoming, (boundary) => boundary.key, "边界 key");
    for (const boundary of incoming) {
      const old = boundaries.get(boundary.key);
      if (old && !same(old, boundary))
        fail(`边界 key 内容冲突，请使用新的 key：${boundary.key}`);
      boundaries.set(boundary.key, boundary);
    }
  };
  if (parentId === null) {
    const backup = parseBackup(value);
    const incomingTree = buildTree(backup.data);
    mergeBoundaries(backup.data.regionBoundaries);
    for (const region of backup.data.regions) {
      const old = regions.get(region.id);
      if (old && old.parentId !== region.parentId)
        fail(`同编码地区的父级冲突：${region.id}`);
      regions.set(region.id, region);
    }
    for (const region of backup.data.regions) {
      const old = oldTree.byId.get(region.id);
      if (!old) continue;
      const oldChildren = (oldTree.children.get(region.id) ?? [])
        .map((item) => item.id)
        .sort();
      const newChildren = (incomingTree.children.get(region.id) ?? [])
        .map((item) => item.id)
        .sort();
      const sameChildren = same(oldChildren, newChildren);
      const incomingSubset = newChildren.every((key) =>
        oldChildren.includes(key),
      );
      const incomingComplete =
        region.state === "complete" &&
        oldChildren.every((key) => newChildren.includes(key));
      const state =
        incomingComplete || (old.state === "complete" && incomingSubset)
          ? "complete"
          : old.state === "unloaded" &&
              region.state === "unloaded" &&
              sameChildren
            ? "unloaded"
            : "partial";
      const importTimes = [old.importedAt, region.importedAt]
        .filter((value): value is string => Boolean(value))
        .sort();
      const importedAt = importTimes[importTimes.length - 1];
      regions.set(region.id, {
        ...region,
        state,
        ...(importedAt ? { importedAt } : {}),
      });
      if (state === "partial" && region.state === "complete")
        warnings.push(`${region.name}仍有本地额外下级，保留部分导入状态。`);
    }
    for (const footprint of backup.data.footprints)
      footprints.set(footprint.id, footprint);
  } else {
    const envelope = object(value, "下级地区清单");
    fields(
      envelope,
      ["format", "version", "parentId", "coverage", "children", "boundaries"],
      "下级地区清单",
    );
    if (
      envelope.format !== "todo-list-region-children" ||
      envelope.version !== 1
    )
      fail("请选择 version 为 1 的 todo-list-region-children 清单");
    if (envelope.parentId !== parentId)
      fail(`清单父级必须是当前地区 ${parentId}`);
    const parent = regions.get(parentId) ?? fail("目标父地区不存在");
    const coverage = choice(
      envelope.coverage,
      ["partial", "complete"],
      "清单完整性",
    );
    const incoming = array(envelope.children, "直接下级").map(
      (value, index) => {
        const child = object(value, "下级地区");
        fields(
          child,
          [
            "id",
            "name",
            "kind",
            "pos",
            "aliases",
            "classification",
            "sortOrder",
            "notes",
            "boundaryKey",
          ],
          "下级地区",
        );
        parsePos(child.pos);
        string(child.name, "地区名称");
        string(child.kind, "地区级别");
        const childId = id(child.id, "地区编码"),
          old = regions.get(childId);
        if (old && old.parentId !== parentId)
          fail(`同编码地区的父级冲突：${childId}`);
        return parseRegion({
          aliases: [],
          classification: "administrative",
          sortOrder: index,
          notes: "",
          boundaryKey: null,
          state: "unloaded",
          ...old,
          ...child,
          parentId,
        });
      },
    );
    const incomingIds = new Set(
      unique(incoming, (region) => region.id, "地区编码").keys(),
    );
    const attached =
      envelope.boundaries === undefined
        ? []
        : array(envelope.boundaries, "边界附件").map(parseBoundary);
    for (const boundary of attached)
      if (!incoming.some((region) => region.boundaryKey === boundary.key))
        fail(`边界附件未被本次下级引用：${boundary.key}`);
    mergeBoundaries(attached);
    for (const region of incoming) regions.set(region.id, region);
    const extras = existing.regions.filter(
      (region) => region.parentId === parentId && !incomingIds.has(region.id),
    );
    const additions = incoming.some((region) => !oldTree.byId.has(region.id));
    const state =
      coverage === "complete"
        ? extras.length
          ? "partial"
          : "complete"
        : parent.state === "complete" && !additions
          ? "complete"
          : "partial";
    if (coverage === "complete" && extras.length)
      warnings.push(
        `保留 ${extras.length} 个清单未包含的本地下级及其后代，父级仍标为部分导入。`,
      );
    regions.set(parentId, { ...parent, state, importedAt: now });
  }
  data.regions = [...regions.values()];
  data.footprints = [...footprints.values()];
  data.regionBoundaries = [...boundaries.values()];
  validateSnapshot(data, new Set(boundaries.keys()));
  for (const region of data.regions) {
    const before = oldTree.byId.get(region.id);
    if (!same(before, region))
      changes.push({
        store: "regions",
        id: region.id,
        name: region.name,
        before,
        after: region,
      });
  }
  for (const footprint of data.footprints) {
    const before = oldFootprints.get(footprint.id);
    if (!same(before, footprint))
      changes.push({
        store: "footprints",
        id: footprint.id,
        name: footprint.name,
        before,
        after: footprint,
      });
  }
  for (const boundary of data.regionBoundaries) {
    const before = oldBoundaries.get(boundary.key);
    if (!same(before, boundary))
      changes.push({
        store: "regionBoundaries",
        id: boundary.key,
        name: boundary.key,
        before,
        after: boundary,
      });
  }
  return { data, changes, warnings };
};

export const exportData = (
  data: TravelData,
  regionId?: string,
): FootprintExport => {
  const result = structuredClone(data);
  if (regionId !== undefined) {
    const tree = buildTree(data);
    if (!tree.byId.has(regionId)) fail("待导出的地区不存在");
    const descendants = new Set(
      data.regions
        .filter((region) =>
          tree.path(region.id).some((parent) => parent.id === regionId),
        )
        .map((region) => region.id),
    );
    const included = new Set([
      ...descendants,
      ...tree.path(regionId).map((region) => region.id),
    ]);
    result.regions = result.regions
      .filter((region) => included.has(region.id))
      .map((region) => ({
        ...region,
        state: (tree.children.get(region.id) ?? []).some(
          (child) => !included.has(child.id),
        )
          ? "partial"
          : region.state,
      }));
    result.footprints = result.footprints.filter((footprint) =>
      descendants.has(footprint.regionId),
    );
    const keys = new Set(result.regions.map((region) => region.boundaryKey));
    result.regionBoundaries = result.regionBoundaries.filter((boundary) =>
      keys.has(boundary.key),
    );
  }
  return {
    format: "todo-list-footprints",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: result,
  };
};

export const filterFootprints = (
  footprints: Footprint[],
  year: string,
  visitType: string,
): Footprint[] =>
  footprints.filter(
    (footprint) =>
      (!year ||
        (year === "unknown"
          ? footprint.time === null
          : footprint.time?.slice(0, 4) === year)) &&
      (!visitType || footprint.visitType === visitType),
  );
