import type { IncomingMessage, ServerResponse } from "node:http";
import { handleBridgeHttp } from "../bridge/http.ts";
import type { BridgeBroker } from "../bridge/broker.ts";
import { parseCatalogBridgeRpcRequest } from "../../src/pages/works/bridge/protocol.ts";

export const handleCatalogBridgeHttp = (
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  broker: BridgeBroker,
) =>
  handleBridgeHttp(request, response, pathname, broker, {
    prefix: "/__catalog",
    parseRequest: parseCatalogBridgeRpcRequest,
  });
