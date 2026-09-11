import type { Server } from "node:http";
import { createBridgeServer } from "../bridge/server.ts";
import { parseCatalogBridgeRpcRequest } from "../../src/pages/works/bridge/protocol.ts";

export type { BridgeServer as CatalogBridgeServer } from "../bridge/server.ts";
export const createCatalogBridgeServer = (server: Server) =>
  createBridgeServer(server, [
    { prefix: "/__catalog", parseRequest: parseCatalogBridgeRpcRequest },
  ]);
