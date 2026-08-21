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
import { ServiceContext } from "./context.js";

const deserializeError = (error: SerializedError): Error => {
  const result = new Error(error.message);
  result.name = error.name;
  return result;
};

export const ServiceWrapper = ({ children }: PropsWithChildren) => {
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState<Error | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef(new Map<string, PendingCallback>());

  const handleMessage = useCallback((event: MessageEvent<WorkerResponse>) => {
    const message = event.data;

    if (message.type === "ready") {
      setStartupError(message.error ? deserializeError(message.error) : null);
      setLoading(false);
      return;
    }

    const callback = callbacksRef.current.get(message.id);
    if (!callback) return;

    callback(
      message.error ? deserializeError(message.error) : null,
      message.data,
    );
    callbacksRef.current.delete(message.id);
  }, []);

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
      callbacksRef.current.clear();
    };
  }, [handleMessage]);

  if (loading) return null;
  if (startupError) {
    return <p role="alert">Unable to open the to-do database.</p>;
  }

  return (
    <ServiceContext.Provider value={invoke}>{children}</ServiceContext.Provider>
  );
};
