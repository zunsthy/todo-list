export type BridgeStatus =
  "disabled" | "connecting" | "connected" | "reconnecting" | "error";

export interface BridgeRpcRequest {
  type: "request";
  id: string;
  method: string;
  params: object;
}
export interface BridgeRpcError {
  code: string;
  message: string;
}
export type BridgeRpcResponse =
  | { type: "response"; id: string; ok: true; result: unknown }
  | { type: "response"; id: string; ok: false; error: BridgeRpcError };
export interface BridgeRegisterMessage {
  type: "register";
  protocol: 1;
  pageId: string;
}
export interface BridgeReadyMessage {
  type: "ready";
  protocol: 1;
  pageId: string;
}
export type BridgePageMessage = BridgeRegisterMessage | BridgeRpcResponse;
export type BridgeServerMessage<Request = BridgeRpcRequest> =
  BridgeReadyMessage | Request;
export interface BridgePageInfo {
  pageId: string;
  connectedAt: string;
}
