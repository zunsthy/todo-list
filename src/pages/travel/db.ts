import {
  buildTree,
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
  // leaf checks and import conflict checks. Never await inside a transaction.
  const transact = <T>(
    mode: IDBTransactionMode,
    includeBoundaries: boolean,
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
      let remaining = 3,
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
      const boundaries = includeBoundaries
        ? transaction.objectStore("regionBoundaries").getAll()
        : transaction.objectStore("regionBoundaries").getAllKeys();
      boundaries.onsuccess = () => {
        if (includeBoundaries) {
          state.boundaries = boundaries.result as RegionBoundary[];
          state.boundaryKeys = new Set(
            state.boundaries.map((boundary) => boundary.key),
          );
        } else state.boundaryKeys = new Set(boundaries.result as string[]);
        loaded();
      };
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
      throw new Error(`${label}已被其他操作修改，请关闭编辑器并重新打开`);
  };
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
    saveRegion: (value: Region, previous: Region | null) =>
      transact(
        "readwrite",
        false,
        ({ snapshot, boundaryKeys }, transaction) => {
          const region = parseRegion(value),
            old = snapshot.regions.find((item) => item.id === region.id);
          assertCurrent(old, previous, "地区");
          if (
            previous &&
            (previous.id !== region.id || previous.parentId !== region.parentId)
          )
            throw new Error("普通编辑不能修改地区编码或父级");
          const next = {
            ...snapshot,
            regions: snapshot.regions.filter((item) => item.id !== region.id),
          };
          const saved = previous
            ? {
                ...region,
                state: previous.state,
                ...(previous.importedAt
                  ? { importedAt: previous.importedAt }
                  : {}),
              }
            : { ...region, state: "unloaded" as const };
          if (!previous) delete saved.importedAt;
          next.regions.push(saved);
          let parent: Region | undefined;
          if (!previous && region.parentId !== null) {
            const current = next.regions.find(
              (item) => item.id === region.parentId,
            );
            if (!current) throw new Error("父地区不存在");
            parent = { ...current, state: "partial" };
            next.regions = next.regions.map((item) =>
              item.id === parent!.id ? parent! : item,
            );
          }
          validateSnapshot(next, boundaryKeys);
          const store = transaction.objectStore("regions");
          store.put(saved);
          if (parent) store.put(parent);
        },
      ),
    deleteRegion: (previous: Region) =>
      transact("readwrite", false, ({ snapshot }, transaction) => {
        assertCurrent(
          snapshot.regions.find((region) => region.id === previous.id),
          previous,
          "地区",
        );
        if (
          snapshot.regions.some((region) => region.parentId === previous.id) ||
          snapshot.footprints.some(
            (footprint) => footprint.regionId === previous.id,
          )
        )
          throw new Error("地区仍有下级或足迹引用，不能删除");
        const store = transaction.objectStore("regions");
        store.delete(previous.id);
        const parent = snapshot.regions.find(
          (region) => region.id === previous.parentId,
        );
        if (parent?.state === "complete")
          store.put({ ...parent, state: "partial" });
      }),
    saveFootprint: (value: Footprint, previous: Footprint | null) =>
      transact(
        "readwrite",
        false,
        ({ snapshot, boundaryKeys }, transaction) => {
          const footprint = parseFootprint(value),
            old = snapshot.footprints.find((item) => item.id === footprint.id);
          assertCurrent(old, previous, "足迹");
          if (previous && previous.id !== footprint.id)
            throw new Error("不能修改足迹 ID");
          if (
            (!previous || previous.regionId !== footprint.regionId) &&
            !buildTree(snapshot).isLeaf(footprint.regionId)
          )
            throw new Error("新建或更换地区时请选择没有本地下级的叶节点");
          validateSnapshot(
            {
              ...snapshot,
              footprints: [
                ...snapshot.footprints.filter(
                  (item) => item.id !== footprint.id,
                ),
                footprint,
              ],
            },
            boundaryKeys,
          );
          transaction.objectStore("footprints").put(footprint);
        },
      ),
    deleteFootprint: (previous: Footprint) =>
      transact("readwrite", false, ({ snapshot }, transaction) => {
        assertCurrent(
          snapshot.footprints.find((footprint) => footprint.id === previous.id),
          previous,
          "足迹",
        );
        // Intentionally no region, state, or boundary writes here.
        transaction.objectStore("footprints").delete(previous.id);
      }),
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
