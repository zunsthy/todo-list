const log = console.log.bind(console, "%c[IDB]", "color: aqua");

const version = 1;

let db;

const createStore = (db) => {
  let store;
  store = db.createObjectStore("series", {
    keyPath: "id",
    autoIncrement: true,
  });
  store.createIndex("name", "name", { unique: true });

  store = db.createObjectStore("category", {
    keyPath: "id",
    autoIncrement: true,
  });
  store.createIndex("name", "name", { unique: false });

  store = db.createObjectStore("item", {
    keyPath: "id",
    autoIncrement: true,
  });
  store.createIndex("name", "name", { unique: false });
};

export const open = (cb) => {
  if (db) return;

  const handleError = (ev) => {
    const { error, errorCode } = ev.target;
    log("access failed", errorCode, error);
    cb(error);
  };

  const handleSuccess = (ev) => {
    db = ev.target.result;
    log("open success");
    cb(null, db);
  };

  const handleUpgrade = (ev) => {
    db = ev.target.result;
    log("need to upgrade");
    createStore(db);
    cb(null, db);
  };

  const request = self.indexedDB.open("todo", version);
  request.addEventListener("error", handleError);
  request.addEventListener("success", handleSuccess);
  request.addEventListener("upgradeneeded", handleUpgrade);
};

export const close = () => {
  db.close();
  db = null;
};

export const loadAll = (cb) => {
  const storeNames = ["series", "category", "item"];
  const result = {};
  const ts = db.transaction(storeNames, "readonly");
  ts.addEventListener("error", (ev) => {
    const err = ev.target.error;
    log("load data error:", err);
    cb(err);
  });
  ts.addEventListener("complete", () => {
    cb(null, result);
  });
  storeNames.forEach((storeName) => {
    const store = ts.objectStore(storeName);
    const request = store.getAll();
    request.addEventListener("success", (ev) => {
      const records = ev.target.result;
      result[storeName] = records;
    });
  });
};
