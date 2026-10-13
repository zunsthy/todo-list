import { useEffect, useRef, useState } from "react";
import { createBridgeClient } from "../../../shared/bridge/client.ts";
import type { BridgeStatus } from "../../../shared/bridge/types.ts";
import type { TravelDataState } from "../hooks/useTravelData.ts";
import {
  parseTravelBridgeRpcRequest,
  travelBridgeSessionKey,
} from "./protocol.ts";
import { createTravelBridgeRouter } from "./router.ts";

const bridgeUrl = () => {
  const path = document.querySelector<HTMLMetaElement>(
    'meta[name="todo-list-travel-bridge"]',
  )?.content;
  if (!path) return null;
  const url = new URL(path, location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
};
const remember = (pageId: string | null) => {
  try {
    if (pageId) sessionStorage.setItem(travelBridgeSessionKey, pageId);
    else sessionStorage.removeItem(travelBridgeSessionKey);
  } catch {
    /* Control still works without session storage. */
  }
};

export const useTravelBridge = (data: TravelDataState) => {
  const [url] = useState(bridgeUrl);
  const [pageId, setPageId] = useState<string | null>(() => {
    try {
      return url ? sessionStorage.getItem(travelBridgeSessionKey) : null;
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<BridgeStatus>(
    pageId ? "connecting" : "disabled",
  );
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(() => {});
  const { database, refresh, reportError, setWriteBlocked } = data;
  const enabled = pageId !== null;

  useEffect(() => {
    setWriteBlocked(enabled);
  }, [enabled, setWriteBlocked]);
  useEffect(() => {
    if (!database || !pageId || !url) return;
    const router = createTravelBridgeRouter(database, () => {
      void refresh(true).catch(reportError);
    });
    const client = createBridgeClient({
      parseRequest: parseTravelBridgeRpcRequest,
      route: router.route,
      onStatus: (next, _id, message) => {
        setStatus(next);
        setError(message ?? null);
      },
    });
    const stop = () => {
      client.disconnect();
      router.close();
    };
    stopRef.current = stop;
    client.connect(url, pageId);
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
      stopRef.current = () => {};
    };
  }, [database, pageId, url, refresh, reportError]);
  const disable = () => {
    stopRef.current();
    remember(null);
    setPageId(null);
    setStatus("disabled");
    setError(null);
    setWriteBlocked(false);
  };
  const enable = () => {
    if (!database || !url || data.busy || enabled) return;
    try {
      const nextId = crypto.randomUUID();
      remember(nextId);
      setWriteBlocked(true);
      setPageId(nextId);
      setStatus("connecting");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
      setWriteBlocked(false);
    }
  };
  return {
    available: Boolean(url),
    enabled,
    status,
    pageId,
    error,
    disable,
    toggle: () => {
      if (enabled) disable();
      else enable();
    },
  };
};
export type TravelBridgeState = ReturnType<typeof useTravelBridge>;
