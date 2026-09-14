import {
  chinaRegion,
  exportData,
  parseFootprint,
  parseRegion,
  planImport,
  same,
  validateSnapshot,
} from "./model.ts";
import type {
  Footprint,
  ImportPreview,
  Region,
  RegionBoundary,
  TravelData,
  TravelSnapshot,
} from "./types.ts";
import {
  mutationBaseline,
  mutationBoundarySelection,
  planTravelMutations,
  prepareTravelOperations,
  TravelMutationError,
  type TravelMutationPlan,
  type TravelMutationPreview,
} from "./mutations.ts";

const stores = ["regions", "footprints", "regionBoundaries"] as const;
interface ReadState {
  snapshot: TravelSnapshot;
  boundaryKeys: Set<string>;
  boundaries: RegionBoundary[];
}

export const openTravelDatabase = (
  name = "todo-list-travel",
): Promise<TravelDatabase> =>
  new Promise((resolve, reject) => {
    let blocked = false;
    const request = globalThis.indexedDB.open(name, 1);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("足迹数据库升级被其他页面占用，请关闭旧页面后重试"));
    };
    request.onerror = () =>
      reject(request.error ?? new Error("无法打开足迹数据库"));
    request.onupgradeneeded = () => {
      const db = request.result;
      const regions = db.createObjectStore("regions", { keyPath: "id" });
      regions.createIndex("parentId", "parentId");
      regions.createIndex("boundaryKey", "boundaryKey");
      const footprints = db.createObjectStore("footprints", { keyPath: "id" });
      for (const index of ["regionId", "visitType", "time"])
        footprints.createIndex(index, index);
      db.createObjectStore("regionBoundaries", { keyPath: "key" });
      regions.add(chinaRegion());
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      resolve(createDatabase(request.result));
    };
  });

const createDatabase = (database: IDBDatabase) => {
  const listeners = new Set<() => void>();
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(`${database.name}:changes`);
  let closed = false;
  if (channel)
    channel.onmessage = () => {
      for (const listener of listeners) listener();
    };
  const close = () => {
    closed = true;
    database.close();
    channel?.close();
    listeners.clear();
  };
  database.onversionchange = close;

  // Keep reads and writes in the same active IDB request callback, including
  // reference checks and import conflict checks. Never await inside a transaction.
  const transact = <T>(
    mode: IDBTransactionMode,
    includeBoundaries: boolean | string[],
    operation: (state: ReadState, transaction: IDBTransaction) => T,
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      if (closed) {
        reject(new Error("足迹数据库已关闭，请刷新页面"));
        return;
      }
      const transaction = database.transaction([...stores], mode);
      const state: ReadState = {
        snapshot: { regions: [], footprints: [] },
        boundaryKeys: new Set(),
        boundaries: [],
      };
      let remaining =
          3 + (Array.isArray(includeBoundaries) ? includeBoundaries.length : 0),
        result: T,
        error: unknown;
      transaction.onabort = () =>
        reject(error ?? transaction.error ?? new Error("足迹数据操作已回滚"));
      transaction.onerror = () => {
        error ??= transaction.error;
      };
      transaction.oncomplete = () => {
        if (mode === "readwrite" && !closed) channel?.postMessage("changed");
        resolve(result);
      };
      const loaded = () => {
        if (--remaining !== 0) return;
        try {
          result = operation(state, transaction);
        } catch (cause) {
          error = cause;
          transaction.abort();
        }
      };
      const regions = transaction.objectStore("regions").getAll();
      regions.onsuccess = () => {
        state.snapshot.regions = regions.result as Region[];
        loaded();
      };
      const footprints = transaction.objectStore("footprints").getAll();
      footprints.onsuccess = () => {
        state.snapshot.footprints = footprints.result as Footprint[];
        loaded();
      };
      const boundaries =
        includeBoundaries === true
          ? transaction.objectStore("regionBoundaries").getAll()
          : transaction.objectStore("regionBoundaries").getAllKeys();
      boundaries.onsuccess = () => {
        if (includeBoundaries === true) {
          state.boundaries = boundaries.result as RegionBoundary[];
          state.boundaryKeys = new Set(
            state.boundaries.map((boundary) => boundary.key),
          );
        } else state.boundaryKeys = new Set(boundaries.result as string[]);
        loaded();
      };
      if (Array.isArray(includeBoundaries)) {
        for (const key of includeBoundaries) {
          const request = transaction.objectStore("regionBoundaries").get(key);
          request.onsuccess = () => {
            if (request.result)
              state.boundaries.push(request.result as RegionBoundary);
            loaded();
          };
        }
      }
    });
  const completeData = (state: ReadState): TravelData => ({
    ...state.snapshot,
    regionBoundaries: state.boundaries,
  });
  const assertCurrent = (
    current: unknown,
    previous: unknown,
    label: string,
  ) => {
    if (!same(current ?? null, previous))
      throw new TravelMutationError(
        "CONFLICT",
        `${label}已被其他操作修改，请关闭编辑器并重新打开`,
      );
  };
  const savePlan = (plan: TravelMutationPlan, transaction: IDBTransaction) => {
    for (const change of plan.changes) {
      const store = transaction.objectStore(change.store);
      if (change.after) store.put(change.after);
      else store.delete(change.id);
    }
    return plan;
  };
  const write = (
    operations: Record<string, unknown>[],
    check: (state: ReadState) => void,
  ) =>
    transact(
      "readwrite",
      mutationBoundarySelection(operations),
      (state, transaction) => {
        check(state);
        return savePlan(
          planTravelMutations(state, operations, new Date().toISOString()),
          transaction,
        );
      },
    );
  return {
    close,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => transact("readonly", false, (state) => state.snapshot),
    export: (regionId?: string) =>
      transact("readonly", true, (state) =>
        exportData(completeData(state), regionId),
      ),
    getBoundary: (key: string): Promise<RegionBoundary | undefined> =>
      new Promise((resolve, reject) => {
        if (closed) {
          reject(new Error("足迹数据库已关闭"));
          return;
        }
        const transaction = database.transaction(
          "regionBoundaries",
          "readonly",
        );
        const request = transaction.objectStore("regionBoundaries").get(key);
        transaction.oncomplete = () =>
          resolve(request.result as RegionBoundary | undefined);
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("无法读取边界"));
      }),
    saveRegion: (value: Region, previous: Region | null) => {
      const {
        id,
        parentId,
        state: _state,
        importedAt: _importedAt,
        ...changes
      } = value;
      return write(
        [
          previous
            ? { action: "region.update", id, changes }
            : { action: "region.create", data: { id, parentId, ...changes } },
        ],
        ({ snapshot }) => {
          parseRegion(value);
          assertCurrent(
            snapshot.regions.find((item) => item.id === id),
            previous,
            "地区",
          );
          if (
            previous &&
            (previous.id !== id || previous.parentId !== parentId)
          )
            throw new Error("普通编辑不能修改地区编码或父级");
        },
      );
    },
    deleteRegion: (previous: Region) =>
      write([{ action: "region.delete", id: previous.id }], ({ snapshot }) => {
        assertCurrent(
          snapshot.regions.find((item) => item.id === previous.id),
          previous,
          "地区",
        );
      }),
    saveFootprint: (value: Footprint, previous: Footprint | null) => {
      const { id, ...changes } = value;
      return write(
        [
          previous
            ? { action: "footprint.update", id, changes }
            : { action: "footprint.create", data: value },
        ],
        ({ snapshot }) => {
          parseFootprint(value);
          assertCurrent(
            snapshot.footprints.find((item) => item.id === id),
            previous,
            "足迹",
          );
          if (previous && previous.id !== id)
            throw new Error("不能修改足迹 ID");
        },
      );
    },
    deleteFootprint: (previous: Footprint) =>
      write(
        [{ action: "footprint.delete", id: previous.id }],
        ({ snapshot }) => {
          assertCurrent(
            snapshot.footprints.find((item) => item.id === previous.id),
            previous,
            "足迹",
          );
        },
      ),
    previewMutations: async (
      value: unknown,
    ): Promise<TravelMutationPreview> => {
      const operations = prepareTravelOperations(value);
      return transact(
        "readonly",
        mutationBoundarySelection(operations),
        (state) => {
          const time = new Date().toISOString();
          return {
            operations,
            time,
            baseline: mutationBaseline(state),
            plan: planTravelMutations(state, operations, time),
          };
        },
      );
    },
    commitMutations: (preview: TravelMutationPreview) =>
      transact(
        "readwrite",
        mutationBoundarySelection(preview.operations),
        (state, transaction) => {
          if (mutationBaseline(state) !== preview.baseline)
            throw new TravelMutationError(
              "CONFLICT",
              "预览后数据发生变化，请重新预览",
            );
          return savePlan(
            planTravelMutations(state, preview.operations, preview.time),
            transaction,
          );
        },
      ),
    previewImport: (
      source: unknown,
      parentId: string | null,
    ): Promise<ImportPreview> =>
      transact("readonly", true, (state) => {
        const data = completeData(state);
        return {
          source: structuredClone(source),
          parentId,
          baseline: JSON.stringify(data),
          plan: planImport(data, source, parentId, new Date().toISOString()),
        };
      }),
    import: (preview: ImportPreview) =>
      transact("readwrite", true, (state, transaction) => {
        const data = completeData(state);
        if (JSON.stringify(data) !== preview.baseline)
          throw new Error("预览后数据发生变化，请重新预览再导入");
        const plan = planImport(
          data,
          preview.source,
          preview.parentId,
          new Date().toISOString(),
        );
        for (const change of plan.changes)
          transaction.objectStore(change.store).put(change.after);
      }),
  };
};
export type TravelDatabase = ReturnType<typeof createDatabase>;
