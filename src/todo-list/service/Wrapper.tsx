import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type {
  InvokeService,
  PendingCallback,
  SerializedError,
  ServiceCallback,
  ServiceRequest,
  WorkerCommand,
  WorkerResponse,
} from "../../types/service.js";
import type { CatalogBridgeStatus } from "../../types/catalog-bridge.js";
import { CatalogBridgeContext } from "../bridge/context.js";
import { catalogBridgeSessionKey } from "../bridge/protocol.js";
import { ServiceContext } from "./context.js";

const deserializeError = (error: SerializedError): Error => {
  const result = new Error(error.message);
  result.name = error.name;
  return result;
};

const bridgeUrl = (): string | null => {
  const path = document.querySelector<HTMLMetaElement>(
    'meta[name="todo-list-catalog-bridge"]',
  )?.content;
  if (!path) return null;
  const url = new URL(path, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
};

const savedPageId = (available: boolean): string | null => {
  if (!available) return null;
  try {
    return window.sessionStorage.getItem(catalogBridgeSessionKey);
  } catch {
    return null;
  }
};

export const ServiceWrapper = ({ children }: PropsWithChildren) => {
  const [catalogBridgeUrl] = useState(bridgeUrl);
  const [initialPageId] = useState(() =>
    savedPageId(Boolean(catalogBridgeUrl)),
  );
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState<Error | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);
  const callbacksRef = useRef(new Map<string, PendingCallback>());
  const pageIdRef = useRef<string | null>(initialPageId);
  const [pageId, setPageId] = useState<string | null>(initialPageId);
  const [bridgeStatus, setBridgeStatus] = useState<CatalogBridgeStatus>(
    initialPageId ? "connecting" : "disabled",
  );
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [changeVersion, setChangeVersion] = useState(0);

  const handleMessage = useCallback(
    (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      if (message.type === "ready") {
        workerReadyRef.current = true;
        setStartupError(message.error ? deserializeError(message.error) : null);
        setLoading(false);
        const currentPageId = pageIdRef.current;
        if (!message.error && catalogBridgeUrl && currentPageId) {
          workerRef.current?.postMessage({
            type: "bridge-connect",
            url: catalogBridgeUrl,
            pageId: currentPageId,
          } satisfies WorkerCommand);
        }
        return;
      }

      if (message.type === "bridge-status") {
        setBridgeStatus(message.status);
        setBridgeError(message.error ?? null);
        return;
      }

      if (message.type === "catalog-changed") {
        setChangeVersion((version) => version + 1);
        return;
      }

      const callback = callbacksRef.current.get(message.id);
      if (!callback) return;

      callback(
        message.error ? deserializeError(message.error) : null,
        message.data,
      );
      callbacksRef.current.delete(message.id);
    },
    [catalogBridgeUrl],
  );

  const invoke = useCallback<InvokeService>((api, params, callback) => {
    const worker = workerRef.current;
    if (!worker) {
      callback(new Error("The data worker is not ready"));
      return;
    }

    const id = window.crypto.randomUUID();
    callbacksRef.current.set(
      id,
      callback as ServiceCallback<typeof api> as PendingCallback,
    );

    // InvokeService keeps api and params correlated; the mapped request union
    // cannot retain that correlation while this generic callback is constructed.
    const command = { type: "request", id, api, params } as ServiceRequest;
    worker.postMessage(command);
  }, []);

  const enableBridge = useCallback(
    (nextPageId: string): void => {
      if (!catalogBridgeUrl) return;
      pageIdRef.current = nextPageId;
      setPageId(nextPageId);
      setBridgeError(null);
      setBridgeStatus("connecting");
      try {
        window.sessionStorage.setItem(catalogBridgeSessionKey, nextPageId);
      } catch {
        // The bridge still works for this page when session storage is blocked.
      }
      if (workerReadyRef.current) {
        workerRef.current?.postMessage({
          type: "bridge-connect",
          url: catalogBridgeUrl,
          pageId: nextPageId,
        } satisfies WorkerCommand);
      }
    },
    [catalogBridgeUrl],
  );

  const disableBridge = useCallback((): void => {
    pageIdRef.current = null;
    setPageId(null);
    setBridgeStatus("disabled");
    setBridgeError(null);
    try {
      window.sessionStorage.removeItem(catalogBridgeSessionKey);
    } catch {
      // Ignore unavailable session storage.
    }
    workerRef.current?.postMessage({
      type: "bridge-disconnect",
    } satisfies WorkerCommand);
  }, []);

  useEffect(() => {
    setLoading(true);
    const worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", handleMessage);
    workerRef.current = worker;
    worker.postMessage({ type: "start" } satisfies WorkerCommand);

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
      workerRef.current = null;
      workerReadyRef.current = false;
      callbacksRef.current.clear();
    };
  }, [handleMessage]);

  if (loading) return null;
  if (startupError) {
    return <p role="alert">Unable to open the to-do database.</p>;
  }

  return (
    <CatalogBridgeContext.Provider
      value={{
        available: Boolean(catalogBridgeUrl),
        enabled: pageId !== null,
        status: bridgeStatus,
        pageId,
        error: bridgeError,
        changeVersion,
        enable: enableBridge,
        disable: disableBridge,
      }}
    >
      <ServiceContext.Provider value={invoke}>
        {children}
      </ServiceContext.Provider>
    </CatalogBridgeContext.Provider>
  );
};
