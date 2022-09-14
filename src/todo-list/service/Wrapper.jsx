import React, { useCallback, useEffect, useRef, useState } from "react";
import { ServiceContext } from "./context";

export const ServiceWrapper = ({ children }) => {
  const [loading, updateLoading] = useState(true);
  const workerRef = useRef(null);
  const tableRef = useRef(null);

  const handleMessage = (ev) => {
    const {
      data: [id, err, data],
    } = ev;
    if (!id && err === true) {
      updateLoading(false);
      return;
    }

    const table = tableRef.current;
    if (table?.has(id)) {
      const cb = table.get(id);
      table.delete(id);
      cb(err, data);
    }
  };

  const register = (cb) => {
    if (!cb) return null;
    const id = window.crypto.randomUUID();
    tableRef.current.set(id, cb);
    return id;
  };

  const invoke = useCallback((api, params, cb) => {
    const id = register(cb);
    workerRef.current.postMessage([id, api, params]);
  }, []);

  useEffect(() => {
    if (workerRef.current) return;

    updateLoading(true);
    const worker = new Worker(new URL("./worker.js", import.meta.url));
    worker.addEventListener("message", handleMessage);

    workerRef.current = worker;
    tableRef.current = new Map();

    worker.postMessage("start");

    return () => {
      worker.postMessage("stop");
      worker.removeEventListener("message", handleMessage);
      // worker.terminate();

      workerRef.current = null;
      tableRef.current.deleteAll();
      tableRef.current = null;
    };
  }, []);

  return (
    <ServiceContext.Provider value={invoke}>
      {loading ? null : children}
    </ServiceContext.Provider>
  );
};
