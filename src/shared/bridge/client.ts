import type {
  BridgeRpcError,
  BridgeRpcRequest,
  BridgeRpcResponse,
  BridgeStatus,
} from "./types.ts";
import {
  bridgeProtocol,
  parseBridgeServerMessage,
  parseJsonMessage,
} from "./protocol.ts";

interface BridgeClientCallbacks<Request extends BridgeRpcRequest> {
  onStatus(status: BridgeStatus, pageId?: string, error?: string): void;
  parseRequest(value: unknown): Request;
  route(request: Request): Promise<unknown>;
}

const serializeError = (error: unknown): BridgeRpcError => ({
  code:
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : "INTERNAL_ERROR",
  message: error instanceof Error ? error.message : String(error),
});

export const createBridgeClient = <Request extends BridgeRpcRequest>(
  callbacks: BridgeClientCallbacks<Request>,
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

  const handleRequest = async (request: Request, target: WebSocket) => {
    let response: BridgeRpcResponse;
    try {
      response = {
        type: "response",
        id: request.id,
        ok: true,
        result: await callbacks.route(request),
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
        protocol: bridgeProtocol,
        pageId,
      });
    });
    current.addEventListener("message", (event) => {
      if (socket !== current) return;
      try {
        const message = parseBridgeServerMessage(
          parseJsonMessage(String(event.data)),
          callbacks.parseRequest,
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
      callbacks.onStatus("error", pageId, "无法连接数据服务");
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
