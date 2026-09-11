import { createBridgeRequestParser } from "../../../shared/bridge/protocol.ts";

export const travelBridgePath = "/__travel/ws";
export const travelBridgeSessionKey = "todo-list:travel-bridge-page-id";
export const parseTravelBridgeRpcRequest = createBridgeRequestParser([
  "travel.snapshot",
  "travel.regions.get",
  "travel.regions.children",
  "travel.footprints.get",
  "travel.footprints.list",
  "travel.boundaries.get",
  "travel.export",
  "travel.mutations.preview",
  "travel.mutations.commit",
]);
