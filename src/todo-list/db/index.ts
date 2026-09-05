import type {
  CatalogImportData,
  CatalogMutation,
  CatalogRecordMutation,
  CatalogRecordTarget,
  CatalogSnapshot,
  CatalogStoreName,
  CompletionMapping,
} from "../../types/catalog.js";
import type { DatabaseCallback, LegacyTodoItem } from "../../types/database.js";
import { migrateLegacyItems } from "./migrate.ts";

const log = console.log.bind(console, "%c[IDB]", "color: aqua");
const version = 4;
const storeNames = [
  "works",
  "publications",
  "episodes",
  "completion",
] as const satisfies readonly CatalogStoreName[];

let database: IDBDatabase | null = null;

const requestError = (
  error: DOMException | null | undefined,
  fallback: string,
): Error => error ?? new Error(fallback);

const getUpgradeStore = (
  request: IDBOpenDBRequest,
  name: CatalogStoreName,
): IDBObjectStore =>
  request.result.objectStoreNames.contains(name)
    ? request.transaction!.objectStore(name)
    : request.result.createObjectStore(name, { keyPath: "id" });

const createOrUpgradeStores = (request: IDBOpenDBRequest): boolean => {
  const completionCreated =
    !request.result.objectStoreNames.contains("completion");
  const works = getUpgradeStore(request, "works");
  const publications = getUpgradeStore(request, "publications");
  const episodes = getUpgradeStore(request, "episodes");
  getUpgradeStore(request, "completion");

  if (!works.indexNames.contains("title")) {
    works.createIndex("title", "title");
  }
  if (!publications.indexNames.contains("workId")) {
    publications.createIndex("workId", "workId");
  }
  if (!episodes.indexNames.contains("publicationId")) {
    episodes.createIndex("publicationId", "publicationId");
  }
  return completionCreated;
};

const initializeCompletionStore = (request: IDBOpenDBRequest): void => {
  const transaction = request.transaction!;
  const completion = transaction.objectStore("completion");
  for (const storeName of ["works", "publications", "episodes"] as const) {
    const keys = transaction.objectStore(storeName).getAllKeys();
    keys.addEventListener("success", () => {
      for (const key of keys.result) {
        if (typeof key === "string") {
          completion.put({
            id: key,
            completed: false,
          } satisfies CompletionMapping);
        }
      }
    });
  }
};

const migrateLegacyStore = (request: IDBOpenDBRequest): void => {
  const currentDatabase = request.result;
  const transaction = request.transaction;
  if (!transaction || !currentDatabase.objectStoreNames.contains("items")) {
    return;
  }

  const legacyRequest = transaction.objectStore("items").getAll();
  legacyRequest.addEventListener("success", () => {
    const items = legacyRequest.result as LegacyTodoItem[];
    const migrated = migrateLegacyItems(items);
    for (const work of migrated.works) {
      transaction.objectStore("works").put(work);
    }
    for (const publication of migrated.publications) {
      transaction.objectStore("publications").put(publication);
    }
    for (const episode of migrated.episodes) {
      transaction.objectStore("episodes").put(episode);
    }
    for (const mapping of migrated.completion) {
      transaction.objectStore("completion").put(mapping);
    }

    currentDatabase.deleteObjectStore("items");
    log("migrated legacy items", items.length);
  });
};

export const open = (callback: DatabaseCallback<IDBDatabase>): void => {
  if (database) {
    callback(null, database);
    return;
  }

  const request = globalThis.indexedDB.open("todo", version);
  request.addEventListener("error", () => {
    const error = requestError(request.error, "Unable to open the database");
    log("access failed", error);
    callback(error);
  });
  request.addEventListener("success", () => {
    database = request.result;
    database.addEventListener("versionchange", close, { once: true });
    log("open success");
    callback(null, database);
  });
  request.addEventListener("upgradeneeded", () => {
    log("upgrade to catalog schema");
    if (createOrUpgradeStores(request)) {
      initializeCompletionStore(request);
    }
    migrateLegacyStore(request);
  });
};

export const close = (): void => {
  database?.close();
  database = null;
};

const readCatalog = (
  transaction: IDBTransaction,
  onLoaded: (snapshot: CatalogSnapshot) => void,
): void => {
  const result: CatalogSnapshot = {
    works: [],
    publications: [],
    episodes: [],
    completion: [],
  };
  let remaining: number = storeNames.length;
  const readStore = <Store extends CatalogStoreName>(
    storeName: Store,
  ): void => {
    const request = transaction.objectStore(storeName).getAll();
    request.addEventListener("success", () => {
      result[storeName] = request.result as CatalogSnapshot[Store];
      remaining -= 1;
      // Continue synchronously inside the request event while the transaction
      // is active, so a caller can safely enqueue writes after reading.
      if (remaining === 0) onLoaded(result);
    });
  };
  for (const storeName of storeNames) readStore(storeName);
};

export const loadAll = (callback: DatabaseCallback<CatalogSnapshot>): void => {
  if (!database) {
    callback(new Error("The database is not open"));
    return;
  }

  let result: CatalogSnapshot | undefined;
  const transaction = database.transaction([...storeNames], "readonly");
  let settled = false;

  const finish = (error: Error | null): void => {
    if (settled) return;
    settled = true;
    callback(error, error ? undefined : result);
  };

  transaction.addEventListener("error", () => {
    finish(requestError(transaction.error, "Unable to load the catalog"));
  });
  transaction.addEventListener("abort", () => {
    finish(requestError(transaction.error, "Loading the catalog was aborted"));
  });
  transaction.addEventListener("complete", () => finish(null));

  readCatalog(transaction, (snapshot) => {
    result = snapshot;
  });
};

const mutate = (
  method: "add" | "put",
  mutation: CatalogMutation,
  callback: DatabaseCallback,
): void => {
  if (!database) {
    callback(new Error("The database is not open"));
    return;
  }

  const transaction = database.transaction(
    mutation.storeName === "completion"
      ? "completion"
      : [mutation.storeName, "completion"],
    "readwrite",
  );
  let settled = false;

  const finish = (error: Error | null): void => {
    if (settled) return;
    settled = true;
    if (error) {
      log(`${method} data error`, error);
      callback(error);
      return;
    }
    log(`${method} data success`, mutation);
    callback(null);
  };

  transaction.addEventListener("error", () => {
    finish(requestError(transaction.error, `Unable to ${method} data`));
  });
  transaction.addEventListener("abort", () => {
    finish(
      requestError(transaction.error, `${method} transaction was aborted`),
    );
  });
  transaction.addEventListener("complete", () => finish(null));

  const store = transaction.objectStore(mutation.storeName);
  for (const data of mutation.dataList) {
    if (method === "add") {
      store.add(data);
    } else {
      store.put(data);
    }
    if (method === "add" && mutation.storeName !== "completion") {
      transaction.objectStore("completion").put({
        id: data.id,
        completed: false,
      } satisfies CompletionMapping);
    }
  }
};

export const add = (
  mutation: CatalogRecordMutation,
  callback: DatabaseCallback,
): void => mutate("add", mutation, callback);

export const update = (
  mutation: CatalogMutation,
  callback: DatabaseCallback,
): void => mutate("put", mutation, callback);

export const remove = (
  target: CatalogRecordTarget,
  callback: DatabaseCallback,
): void => {
  if (!database) {
    callback(new Error("The database is not open"));
    return;
  }

  const transaction = database.transaction([...storeNames], "readwrite");
  const works = transaction.objectStore("works");
  const publications = transaction.objectStore("publications");
  const episodes = transaction.objectStore("episodes");
  const completion = transaction.objectStore("completion");
  let settled = false;

  const finish = (error: Error | null): void => {
    if (settled) return;
    settled = true;
    callback(error);
  };
  transaction.addEventListener("error", () => {
    finish(requestError(transaction.error, "Unable to delete catalog data"));
  });
  transaction.addEventListener("abort", () => {
    finish(
      requestError(transaction.error, "Deleting catalog data was aborted"),
    );
  });
  transaction.addEventListener("complete", () => finish(null));

  const deleteEpisodes = (publicationId: string): void => {
    const request = episodes.index("publicationId").openCursor(publicationId);
    request.addEventListener("success", () => {
      const cursor = request.result;
      if (!cursor) return;
      completion.delete(cursor.primaryKey);
      cursor.delete();
      cursor.continue();
    });
  };

  completion.delete(target.id);
  if (target.storeName === "works") {
    works.delete(target.id);
    const request = publications.index("workId").openCursor(target.id);
    request.addEventListener("success", () => {
      const cursor = request.result;
      if (!cursor) return;
      if (typeof cursor.primaryKey === "string") {
        completion.delete(cursor.primaryKey);
        deleteEpisodes(cursor.primaryKey);
      }
      cursor.delete();
      cursor.continue();
    });
  } else if (target.storeName === "publications") {
    publications.delete(target.id);
    deleteEpisodes(target.id);
  } else {
    episodes.delete(target.id);
  }
};

export const importData = (
  data: CatalogImportData,
  callback: DatabaseCallback,
): void => {
  if (!database) {
    callback(new Error("The database is not open"));
    return;
  }

  const transaction = database.transaction([...storeNames], "readwrite");
  const works = transaction.objectStore("works");
  const publications = transaction.objectStore("publications");
  const episodes = transaction.objectStore("episodes");
  const completion = transaction.objectStore("completion");
  const suppliedCompletion = new Set(
    (data.completion ?? []).map(({ id }) => id),
  );
  let settled = false;

  const finish = (error: Error | null): void => {
    if (settled) return;
    settled = true;
    callback(error);
  };
  transaction.addEventListener("error", () => {
    finish(requestError(transaction.error, "Unable to import catalog data"));
  });
  transaction.addEventListener("abort", () => {
    finish(
      requestError(transaction.error, "Importing catalog data was aborted"),
    );
  });
  transaction.addEventListener("complete", () => finish(null));

  const ensureCompletion = (id: string): void => {
    if (suppliedCompletion.has(id)) return;
    const request = completion.get(id);
    request.addEventListener("success", () => {
      if (request.result === undefined) {
        completion.put({ id, completed: false } satisfies CompletionMapping);
      }
    });
  };

  for (const record of data.works ?? []) {
    works.put(record);
    ensureCompletion(record.id);
  }
  for (const record of data.publications ?? []) {
    publications.put(record);
    ensureCompletion(record.id);
  }
  for (const record of data.episodes ?? []) {
    episodes.put(record);
    ensureCompletion(record.id);
  }
  for (const record of data.completion ?? []) completion.put(record);
};

export const mutateCatalog = <Result>(
  transform: (snapshot: CatalogSnapshot) => {
    snapshot: CatalogSnapshot;
    result: Result;
  },
  callback: DatabaseCallback<Result>,
): void => {
  if (!database) {
    callback(new Error("The database is not open"));
    return;
  }

  const transaction = database.transaction([...storeNames], "readwrite");
  let result: Result | undefined;
  let transformError: Error | null = null;
  transaction.addEventListener("abort", () => {
    callback(
      transformError ??
        requestError(transaction.error, "Updating catalog data was aborted"),
    );
  });
  transaction.addEventListener("complete", () => callback(null, result));

  readCatalog(transaction, (current) => {
    try {
      // The transform must be synchronous and preserve unchanged record
      // references. Read and write under the same lock to prevent lost updates,
      // including requests from other connections to this database.
      const next = transform(current);
      result = next.result;
      for (const storeName of storeNames) {
        if (current[storeName] === next.snapshot[storeName]) continue;
        const store = transaction.objectStore(storeName);
        const previous = new Map<string, { id: string }>(
          current[storeName].map((record) => [record.id, record]),
        );
        for (const record of next.snapshot[storeName]) {
          if (previous.get(record.id) !== record) store.put(record);
          previous.delete(record.id);
        }
        for (const id of previous.keys()) store.delete(id);
      }
    } catch (error: unknown) {
      transformError =
        error instanceof Error ? error : new Error(String(error));
      transaction.abort();
    }
  });
};
