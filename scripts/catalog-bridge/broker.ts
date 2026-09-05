import type {
  CatalogBridgePageInfo,
  CatalogBridgeRpcRequest,
  CatalogBridgeRpcResponse,
} from "../../src/types/catalog-bridge.ts";
import {
  catalogBridgeProtocol,
  parseCatalogBridgePageMessage,
  parseJsonMessage,
} from "../../src/todo-list/bridge/protocol.ts";
import type { RawData, WebSocket } from "ws";

interface PendingRequest {
  resolve: (response: CatalogBridgeRpcResponse) => void;
  reject: (error: CatalogBridgeBrokerError) => void;
  timeout: NodeJS.Timeout;
}

interface PageConnection {
  socket: WebSocket;
  connectedAt: string;
  pending: Map<string, PendingRequest>;
}

export class CatalogBridgeBrokerError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "CatalogBridgeBrokerError";
  }
}

const messageText = (data: RawData): string =>
  Array.isArray(data)
    ? Buffer.concat(data).toString("utf8")
    : Buffer.isBuffer(data)
      ? data.toString("utf8")
      : Buffer.from(data).toString("utf8");

const send = (socket: WebSocket, value: unknown): void => {
  socket.send(JSON.stringify(value));
};

export class CatalogBridgeBroker {
  readonly #pages = new Map<string, PageConnection>();
  readonly #requestTimeoutMs: number;

  constructor(requestTimeoutMs = 30_000) {
    this.#requestTimeoutMs = requestTimeoutMs;
  }

  accept(socket: WebSocket): void {
    let pageId: string | null = null;
    const registrationTimeout = setTimeout(() => {
      socket.close(4000, "register timeout");
    }, 5_000);

    socket.on("message", (data) => {
      try {
        const message = parseCatalogBridgePageMessage(
          parseJsonMessage(messageText(data)),
        );
        if (message.type === "register") {
          if (pageId) throw new Error("页面已经注册");
          pageId = message.pageId;
          clearTimeout(registrationTimeout);

          const previous = this.#pages.get(pageId);
          if (previous) {
            this.#rejectPending(
              previous,
              new CatalogBridgeBrokerError(
                "PAGE_DISCONNECTED",
                "页面连接已被同一 pageId 的新连接替换",
                502,
              ),
            );
            previous.socket.close(4001, "replaced");
          }

          this.#pages.set(pageId, {
            socket,
            connectedAt: new Date().toISOString(),
            pending: new Map(),
          });
          send(socket, {
            type: "ready",
            protocol: catalogBridgeProtocol,
            pageId,
          });
          console.log(`Catalog bridge page: ${pageId}`);
          return;
        }

        if (!pageId) throw new Error("页面尚未注册");
        const page = this.#pages.get(pageId);
        if (!page || page.socket !== socket) return;
        const pending = page.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        page.pending.delete(message.id);
        pending.resolve(message);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        socket.close(1003, message.slice(0, 120));
      }
    });

    socket.on("close", () => {
      clearTimeout(registrationTimeout);
      if (!pageId) return;
      const page = this.#pages.get(pageId);
      if (!page || page.socket !== socket) return;
      this.#pages.delete(pageId);
      this.#rejectPending(
        page,
        new CatalogBridgeBrokerError(
          "PAGE_DISCONNECTED",
          "页面连接已断开；写请求请重新读取数据后确认是否需要重试",
          502,
        ),
      );
    });
  }

  list(): CatalogBridgePageInfo[] {
    return [...this.#pages.entries()]
      .map(([pageId, page]) => ({
        pageId,
        connectedAt: page.connectedAt,
      }))
      .sort((left, right) => left.connectedAt.localeCompare(right.connectedAt));
  }

  request(
    pageId: string,
    request: CatalogBridgeRpcRequest,
  ): Promise<CatalogBridgeRpcResponse> {
    const page = this.#pages.get(pageId);
    if (!page) {
      return Promise.reject(
        new CatalogBridgeBrokerError(
          "PAGE_NOT_CONNECTED",
          `pageId 未连接：${pageId}`,
          404,
        ),
      );
    }
    if (page.pending.has(request.id)) {
      return Promise.reject(
        new CatalogBridgeBrokerError(
          "DUPLICATE_REQUEST_ID",
          `请求 id 正在处理中：${request.id}；请为每次调用使用新的 id`,
          409,
        ),
      );
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!page.pending.delete(request.id)) return;
        reject(
          new CatalogBridgeBrokerError(
            "PAGE_TIMEOUT",
            "页面处理请求超时；写请求请重新读取数据后确认是否需要重试",
            504,
          ),
        );
      }, this.#requestTimeoutMs);
      page.pending.set(request.id, { resolve, reject, timeout });
      try {
        send(page.socket, request);
      } catch (error: unknown) {
        clearTimeout(timeout);
        page.pending.delete(request.id);
        reject(
          new CatalogBridgeBrokerError(
            "PAGE_DISCONNECTED",
            error instanceof Error ? error.message : String(error),
            502,
          ),
        );
      }
    });
  }

  close(): void {
    for (const page of this.#pages.values()) {
      this.#rejectPending(
        page,
        new CatalogBridgeBrokerError(
          "SERVER_CLOSED",
          "开发服务器正在关闭",
          503,
        ),
      );
      page.socket.close(1001, "server shutdown");
    }
    this.#pages.clear();
  }

  #rejectPending(page: PageConnection, error: CatalogBridgeBrokerError): void {
    for (const pending of page.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    page.pending.clear();
  }
}
