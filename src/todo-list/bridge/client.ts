import type {
  CatalogBridgeRpcError,
  CatalogBridgeRpcRequest,
  CatalogBridgeRpcResponse,
  CatalogBridgeStatus,
} from "../../types/catalog-bridge.js";
import {
  catalogBridgeProtocol,
  parseCatalogBridgeServerMessage,
  parseJsonMessage,
} from "./protocol.js";
import { CatalogBridgeError } from "./catalog.js";
import { routeCatalogBridgeRequest } from "./router.js";

interface CatalogBridgeClientCallbacks {
  onStatus(status: CatalogBridgeStatus, pageId?: string, error?: string): void;
  onChanged(): void;
}

const serializeError = (error: unknown): CatalogBridgeRpcError => ({
  code: error instanceof CatalogBridgeError ? error.code : "INTERNAL_ERROR",
  message: error instanceof Error ? error.message : String(error),
});

export const createCatalogBridgeClient = (
  callbacks: CatalogBridgeClientCallbacks,
) => {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let enabled = false;
  let pageId: string | undefined;
  let url: string | undefined;
  let reconnectAttempts = 0;

  const clearReconnect = (): void => {
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const send = (target: WebSocket | null, value: unknown): void => {
    if (target?.readyState === WebSocket.OPEN) {
      target.send(JSON.stringify(value));
    }
  };

  const handleRequest = async (
    request: CatalogBridgeRpcRequest,
    target: WebSocket,
  ) => {
    let response: CatalogBridgeRpcResponse;
    try {
      response = {
        type: "response",
        id: request.id,
        ok: true,
        result: await routeCatalogBridgeRequest(request, callbacks.onChanged),
      };
    } catch (error: unknown) {
      response = {
        type: "response",
        id: request.id,
        ok: false,
        error: serializeError(error),
      };
    }
    send(target, response);
  };

  const open = (reconnecting: boolean): void => {
    if (!enabled || !url || !pageId) return;
    clearReconnect();
    callbacks.onStatus(reconnecting ? "reconnecting" : "connecting", pageId);
    const current = new WebSocket(url);
    socket = current;
    current.addEventListener("open", () => {
      if (socket !== current) {
        current.close(1000, "superseded");
        return;
      }
      reconnectAttempts = 0;
      send(current, {
        type: "register",
        protocol: catalogBridgeProtocol,
        pageId,
      });
    });
    current.addEventListener("message", (event) => {
      if (socket !== current) return;
      try {
        const message = parseCatalogBridgeServerMessage(
          parseJsonMessage(String(event.data)),
        );
        if (message.type === "ready") {
          callbacks.onStatus("connected", pageId);
          return;
        }
        void handleRequest(message, current);
      } catch (error: unknown) {
        callbacks.onStatus(
          "error",
          pageId,
          error instanceof Error ? error.message : String(error),
        );
        current.close();
      }
    });
    current.addEventListener("close", () => {
      if (socket !== current) return;
      socket = null;
      if (!enabled) {
        callbacks.onStatus("disabled");
        return;
      }
      reconnectAttempts += 1;
      const delay = Math.min(5_000, 500 * 2 ** (reconnectAttempts - 1));
      callbacks.onStatus("reconnecting", pageId);
      reconnectTimer = setTimeout(() => open(true), delay);
    });
    current.addEventListener("error", () => {
      if (socket !== current) return;
      callbacks.onStatus("error", pageId, "无法连接目录数据服务");
    });
  };

  return {
    connect(nextUrl: string, nextPageId: string): void {
      enabled = false;
      clearReconnect();
      socket?.close(1000, "reconnect");
      socket = null;
      url = nextUrl;
      pageId = nextPageId;
      enabled = true;
      reconnectAttempts = 0;
      open(false);
    },
    disconnect(): void {
      enabled = false;
      clearReconnect();
      socket?.close(1000, "disabled");
      socket = null;
      pageId = undefined;
      url = undefined;
      callbacks.onStatus("disabled");
    },
  };
};
