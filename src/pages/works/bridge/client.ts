import { createBridgeClient } from "../../../shared/bridge/client.ts";
import type { BridgeStatus } from "../../../shared/bridge/types.ts";
import { parseCatalogBridgeRpcRequest } from "./protocol.ts";
import { routeCatalogBridgeRequest } from "./router.ts";

export const createCatalogBridgeClient = (callbacks: {
  onStatus(status: BridgeStatus, pageId?: string, error?: string): void;
  onChanged(): void;
}) =>
  createBridgeClient({
    onStatus: callbacks.onStatus,
    parseRequest: parseCatalogBridgeRpcRequest,
    route: (request) => routeCatalogBridgeRequest(request, callbacks.onChanged),
  });
