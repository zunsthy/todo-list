import type { IncomingMessage, Server as HttpServer } from "node:http";
import { WebSocketServer } from "ws";
import { catalogBridgePath } from "../../src/todo-list/bridge/protocol.ts";
import { CatalogBridgeBroker } from "./broker.ts";
import { handleCatalogBridgeHttp } from "./http.ts";

export interface CatalogBridgeServer {
  handleHttp(
    request: IncomingMessage,
    response: import("node:http").ServerResponse,
    pathname: string,
  ): boolean;
  close(): void;
}

export const createCatalogBridgeServer = (
  server: HttpServer,
): CatalogBridgeServer => {
  const broker = new CatalogBridgeBroker();
  const webSocketServer = new WebSocketServer({ noServer: true });
  webSocketServer.on("connection", (socket) => broker.accept(socket));

  const handleUpgrade: Parameters<HttpServer["on"]>[1] = (
    request,
    socket,
    head,
  ) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname !== catalogBridgePath) {
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request);
    });
  };
  server.on("upgrade", handleUpgrade);

  return {
    handleHttp: (request, response, pathname) =>
      handleCatalogBridgeHttp(request, response, pathname, broker),
    close: () => {
      server.off("upgrade", handleUpgrade);
      broker.close();
      webSocketServer.close();
    },
  };
};
