import {
  buildTree,
  parseBoundary,
  parseFootprint,
  parseRegion,
  planImport,
  same,
  validateSnapshot,
} from "./model.ts";
import type {
  Footprint,
  Region,
  RegionBoundary,
  TravelData,
  TravelSnapshot,
} from "./types.ts";

export class TravelMutationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TravelMutationError";
    this.code = code;
  }
}
export const mutationObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TravelMutationError("INVALID_REQUEST", "参数必须是对象");
  return value as Record<string, unknown>;
};
export interface TravelMutationState {
  snapshot: TravelSnapshot;
  boundaryKeys: Set<string>;
  boundaries: RegionBoundary[];
}
export interface TravelChange {
  store: keyof TravelData;
  id: string;
  before: Region | Footprint | RegionBoundary | null;
  after: Region | Footprint | RegionBoundary | null;
}
export interface TravelMutationPlan {
  changes: TravelChange[];
  warnings: string[];
}
export interface TravelMutationPreview {
  operations: Record<string, unknown>[];
  baseline: string;
  time: string;
  plan: TravelMutationPlan;
}

// Generate IDs once, so the preview and its commit refer to the same records.
export const prepareTravelOperations = (
  value: unknown,
): Record<string, unknown>[] => {
  if (!Array.isArray(value) || !value.length)
    throw new TravelMutationError(
      "INVALID_REQUEST",
      "operations 必须是非空数组",
    );
  return structuredClone(value).map((value) => {
    const operation = mutationObject(value);
    if (operation.action === "footprint.create") {
      const data = mutationObject(operation.data);
      operation.data = {
        ...data,
        id: data.id ?? globalThis.crypto.randomUUID(),
      };
    }
    return operation;
  });
};
// Import merging needs complete boundary records. Ordinary edits read keys only;
// boundary.put reads just the existing records with the requested keys.
export const mutationBoundarySelection = (
  operations: Record<string, unknown>[],
): true | string[] => {
  if (
    operations.some(
      ({ action }) =>
        action === "region.importChildren" || action === "backup.import",
    )
  )
    return true;
  return [
    ...new Set(
      operations
        .filter(({ action }) => action === "boundary.put")
        .map(({ data }) => {
          const key = mutationObject(data).key;
          if (typeof key !== "string" || !key)
            throw new TravelMutationError(
              "INVALID_REQUEST",
              "边界 key 不能为空",
            );
          return key;
        }),
    ),
  ];
};
export const mutationBaseline = (state: TravelMutationState): string =>
  JSON.stringify({
    ...state.snapshot,
    boundaryKeys: [...state.boundaryKeys].sort(),
    boundaries: [...state.boundaries].sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
  });

const fail = (code: string, message: string): never => {
  throw new TravelMutationError(code, message);
};
const rejectFields = (value: Record<string, unknown>, fields: string[]) => {
  for (const field of fields)
    if (field in value) fail("INVALID_REQUEST", `普通编辑不能修改 ${field}`);
};

export const planTravelMutations = (
  state: TravelMutationState,
  operations: Record<string, unknown>[],
  now: string,
): TravelMutationPlan => {
  const original: TravelData = {
    ...state.snapshot,
    regionBoundaries: state.boundaries,
  };
  let data = structuredClone(original);
  const boundaryKeys = new Set(state.boundaryKeys);
  const warnings: string[] = [];
  const region = (id: unknown) =>
    data.regions.find((item) => item.id === id) ??
    fail("NOT_FOUND", `地区不存在：${String(id)}`);
  const footprint = (id: unknown) =>
    data.footprints.find((item) => item.id === id) ??
    fail("NOT_FOUND", `足迹不存在：${String(id)}`);
  const parentState = (id: string | null, completeOnly = false) => {
    if (id === null) return;
    const parent = region(id);
    if (!completeOnly || parent.state === "complete") parent.state = "partial";
  };
  try {
    for (const operation of operations) {
      switch (operation.action) {
        case "region.create": {
          const value = mutationObject(operation.data);
          rejectFields(value, ["state", "importedAt"]);
          const saved = parseRegion({
            parentId: null,
            aliases: [],
            classification: "administrative",
            sortOrder: 0,
            notes: "",
            pos: null,
            boundaryKey: null,
            ...value,
            state: "unloaded",
          });
          if (data.regions.some(({ id }) => id === saved.id))
            fail("ALREADY_EXISTS", `地区已存在：${saved.id}`);
          parentState(saved.parentId);
          data.regions.push(saved);
          break;
        }
        case "region.update": {
          const old = region(operation.id),
            changes = mutationObject(operation.changes);
          rejectFields(changes, ["id", "parentId", "state", "importedAt"]);
          const saved = parseRegion({ ...old, ...changes });
          data.regions = data.regions.map((item) =>
            item.id === old.id ? saved : item,
          );
          break;
        }
        case "region.delete": {
          const old = region(operation.id);
          if (
            data.regions.some((item) => item.parentId === old.id) ||
            data.footprints.some((item) => item.regionId === old.id)
          )
            fail("CONFLICT", "地区仍有下级或足迹引用，不能删除");
          data.regions = data.regions.filter((item) => item.id !== old.id);
          parentState(old.parentId, true);
          break;
        }
        case "footprint.create":
        case "footprint.update": {
          const creating = operation.action === "footprint.create";
          const old = creating ? null : footprint(operation.id);
          const changes = mutationObject(
            creating ? operation.data : operation.changes,
          );
          if (!creating) rejectFields(changes, ["id"]);
          const saved = parseFootprint({
            time: null,
            notes: "",
            pos: null,
            ...old,
            ...changes,
          });
          if (creating && data.footprints.some(({ id }) => id === saved.id))
            fail("ALREADY_EXISTS", `足迹已存在：${saved.id}`);
          region(saved.regionId);
          if (
            (!old || old.regionId !== saved.regionId) &&
            !buildTree(data).isLeaf(saved.regionId)
          )
            fail(
              "INVALID_REQUEST",
              "新建或更换地区时请选择没有本地下级的叶节点",
            );
          data.footprints = data.footprints.filter(
            (item) => item.id !== saved.id,
          );
          data.footprints.push(saved);
          break;
        }
        case "footprint.delete": {
          const old = footprint(operation.id);
          data.footprints = data.footprints.filter(
            (item) => item.id !== old.id,
          );
          break;
        }
        case "boundary.put": {
          const saved = parseBoundary(operation.data);
          const old = data.regionBoundaries.find(
            (item) => item.key === saved.key,
          );
          if (old && !same(old, saved))
            fail("CONFLICT", `边界 key 内容冲突，请使用新的 key：${saved.key}`);
          if (!old) data.regionBoundaries.push(saved);
          boundaryKeys.add(saved.key);
          break;
        }
        case "region.importChildren":
        case "backup.import": {
          const parentId =
            operation.action === "backup.import"
              ? null
              : region(operation.parentId).id;
          const plan = planImport(data, operation.source, parentId, now);
          data = plan.data;
          for (const boundary of data.regionBoundaries)
            boundaryKeys.add(boundary.key);
          warnings.push(...plan.warnings);
          break;
        }
        default:
          fail("INVALID_REQUEST", `不支持的操作：${String(operation.action)}`);
      }
    }
    validateSnapshot(data, boundaryKeys);
  } catch (error) {
    if (error instanceof TravelMutationError) throw error;
    throw new TravelMutationError(
      "INVALID_REQUEST",
      error instanceof Error ? error.message : String(error),
    );
  }
  const changes: TravelChange[] = [];
  const key = (record: Region | Footprint | RegionBoundary) =>
    "key" in record ? record.key : record.id;
  for (const store of ["regions", "footprints", "regionBoundaries"] as const) {
    const before = new Map(
      original[store].map((record) => [key(record), record]),
    );
    const after = new Map(data[store].map((record) => [key(record), record]));
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      if (!same(before.get(id), after.get(id)))
        changes.push({
          store,
          id,
          before: before.get(id) ?? null,
          after: after.get(id) ?? null,
        });
    }
  }
  return { changes, warnings };
};
