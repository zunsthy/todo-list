import type { CatalogBridgeRpcRequest } from "../types/catalog-bridge.ts";
import {
  createBridgeRequestParser,
  parseBridgeServerMessage,
} from "../../../shared/bridge/protocol.ts";

export {
  bridgeProtocol as catalogBridgeProtocol,
  isObject,
  parseJsonMessage,
  parseBridgePageMessage as parseCatalogBridgePageMessage,
} from "../../../shared/bridge/protocol.ts";

export const catalogBridgePath = "/__catalog/ws";
export const catalogBridgeSessionKey = "todo-list:catalog-bridge-page-id";
const parseRequest = createBridgeRequestParser([
  "catalog.snapshot",
  "catalog.entity.get",
  "catalog.entity.create",
  "catalog.entity.update",
  "catalog.entity.delete",
  "catalog.completion.set",
  "catalog.batch",
]);
export const parseCatalogBridgeRpcRequest = (value: unknown) =>
  parseRequest(value) as CatalogBridgeRpcRequest;
export const parseCatalogBridgeServerMessage = (value: unknown) =>
  parseBridgeServerMessage(value, parseCatalogBridgeRpcRequest);
