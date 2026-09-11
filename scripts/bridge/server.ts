import type {
  IncomingMessage,
  Server as HttpServer,
  ServerResponse,
} from "node:http";
import { WebSocketServer } from "ws";
import { BridgeBroker } from "./broker.ts";
import { handleBridgeHttp, type BridgeModule } from "./http.ts";
import { isLocalBridgeRequest } from "./local-request.ts";

export interface BridgeServer {
  handleHttp(
    request: IncomingMessage,
    response: ServerResponse,
    pathname: string,
  ): boolean;
  close(): void;
}

export const createBridgeServer = (
  server: HttpServer,
  modules: BridgeModule[],
): BridgeServer => {
  const bridges = modules.map((module) => {
    const broker = new BridgeBroker();
    const sockets = new WebSocketServer({ noServer: true });
    sockets.on("connection", (socket) => broker.accept(socket));
    return { module, broker, sockets };
  });
  const upgrade: Parameters<HttpServer["on"]>[1] = (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const bridge = bridges.find(
      ({ module }) => pathname === `${module.prefix}/ws`,
    );
    if (!bridge || !isLocalBridgeRequest(request)) {
      socket.destroy();
      return;
    }
    bridge.sockets.handleUpgrade(request, socket, head, (webSocket) => {
      bridge.sockets.emit("connection", webSocket, request);
    });
  };
  server.on("upgrade", upgrade);
  return {
    handleHttp: (request, response, pathname) =>
      bridges.some(({ module, broker }) =>
        handleBridgeHttp(request, response, pathname, broker, module),
      ),
    close: () => {
      server.off("upgrade", upgrade);
      for (const { broker, sockets } of bridges) {
        broker.close();
        sockets.close();
      }
    },
  };
};
