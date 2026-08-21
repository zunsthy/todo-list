import type { DatabaseCallback } from "../../types/database.js";
import type { StoreName, StoreSnapshot } from "../../types/service.js";
import type { StoredTodoItem } from "../../types/todo-list.js";

const log = console.log.bind(console, "%c[IDB]", "color: aqua");
const version = 2;

let database: IDBDatabase | null = null;

const requestError = (
  error: DOMException | null | undefined,
  fallback: string,
): Error => error ?? new Error(fallback);

const createOrUpgradeStore = (request: IDBOpenDBRequest): void => {
  const currentDatabase = request.result;
  const store = currentDatabase.objectStoreNames.contains("items")
    ? request.transaction?.objectStore("items")
    : currentDatabase.createObjectStore("items", { keyPath: "id" });

  if (store && !store.indexNames.contains("id")) {
    store.createIndex("id", "id", { unique: true });
  }
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
    log("need to upgrade");
    createOrUpgradeStore(request);
  });
};

export const close = (): void => {
  database?.close();
  database = null;
};

export const loadAll = (callback: DatabaseCallback<StoreSnapshot>): void => {
  if (!database) {
    callback(new Error("The database is not open"));
    return;
  }

  const result: StoreSnapshot = { items: [] };
  const transaction = database.transaction(["items"], "readonly");
  let settled = false;

  const finish = (error: Error | null): void => {
    if (settled) return;
    settled = true;
    callback(error, error ? undefined : result);
  };

  transaction.addEventListener("error", () => {
    const error = requestError(transaction.error, "Unable to load data");
    log("load data error", error);
    finish(error);
  });
  transaction.addEventListener("abort", () => {
    finish(requestError(transaction.error, "Loading data was aborted"));
  });
  transaction.addEventListener("complete", () => finish(null));

  const request = transaction.objectStore("items").getAll();
  request.addEventListener("success", () => {
    result.items = request.result as StoredTodoItem[];
  });
};

const mutate = (
  method: "add" | "put",
  storeName: StoreName,
  dataList: readonly StoredTodoItem[],
  callback: DatabaseCallback,
): void => {
  if (!database) {
    callback(new Error("The database is not open"));
    return;
  }

  const transaction = database.transaction([storeName], "readwrite");
  let settled = false;

  const finish = (error: Error | null): void => {
    if (settled) return;
    settled = true;
    if (error) {
      log(`${method} data error`, error);
      callback(error);
      return;
    }
    log(`${method} data success`, dataList);
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

  const store = transaction.objectStore(storeName);
  for (const data of dataList) {
    if (method === "add") {
      store.add(data);
    } else {
      store.put(data);
    }
  }
};

export const add = (
  storeName: StoreName,
  dataList: readonly StoredTodoItem[],
  callback: DatabaseCallback,
): void => mutate("add", storeName, dataList, callback);

export const update = (
  storeName: StoreName,
  dataList: readonly StoredTodoItem[],
  callback: DatabaseCallback,
): void => mutate("put", storeName, dataList, callback);
