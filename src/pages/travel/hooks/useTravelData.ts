import { useCallback, useEffect, useRef, useState } from "react";
import { openTravelDatabase } from "../db.ts";
import type { TravelDatabase } from "../db.ts";
import { emptySnapshot } from "../model.ts";

export const useTravelData = () => {
  const database = useRef<TravelDatabase | null>(null);
  const loadSequence = useRef(0);
  const writeBlocked = useRef(false);
  const setWriteBlocked = useCallback((value: boolean) => {
    writeBlocked.current = value;
  }, []);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const reportError = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : "操作失败，请重试");
  }, []);
  const clearFeedback = useCallback(() => {
    setError("");
    setMessage("");
  }, []);
  const refresh = useCallback(async () => {
    const current = database.current;
    if (!current) return;
    const sequence = ++loadSequence.current;
    const next = await current.snapshot();
    if (sequence !== loadSequence.current || current !== database.current)
      return;
    setSnapshot(next);
    setReady(true);
  }, []);

  useEffect(() => {
    let disposed = false,
      generation = 0,
      unsubscribe: (() => void) | undefined;
    const report = (cause: unknown) => {
      if (!disposed) reportError(cause);
    };
    const initialize = async () => {
      const expected = ++generation;
      try {
        const handle = await openTravelDatabase();
        if (disposed || expected !== generation) {
          handle.close();
          return;
        }
        database.current = handle;
        unsubscribe = handle.subscribe(() => {
          void refresh().catch(report);
        });
        await refresh();
      } catch (cause) {
        report(cause);
      }
    };
    const stop = () => {
      generation++;
      loadSequence.current++;
      unsubscribe?.();
      database.current?.close();
      database.current = null;
    };
    const resume = (event: PageTransitionEvent) => {
      if (event.persisted) void initialize();
    };
    const focus = () => {
      void refresh().catch(report);
    };
    void initialize();
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", focus);
    return () => {
      disposed = true;
      stop();
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", focus);
    };
  }, [refresh, reportError]);

  const run = async (
    operation: (handle: TravelDatabase) => Promise<unknown>,
    success: string,
    write = true,
  ) => {
    if (write && writeBlocked.current)
      throw new Error("服务端控制已开启，请先关闭连接再编辑");
    const handle = database.current;
    if (!handle) throw new Error("数据库尚未就绪，请刷新页面");
    setBusy(true);
    clearFeedback();
    try {
      await operation(handle);
      await refresh();
      setMessage(success);
    } finally {
      setBusy(false);
    }
  };
  return {
    database: database.current,
    snapshot,
    ready,
    busy,
    error,
    message,
    clearFeedback,
    reportError,
    run,
    refresh,
    setWriteBlocked,
  };
};

export type TravelDataState = ReturnType<typeof useTravelData>;
