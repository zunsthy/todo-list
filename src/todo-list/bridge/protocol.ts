import type {
  CatalogBridgeMethod,
  CatalogBridgePageMessage,
  CatalogBridgeRegisterMessage,
  CatalogBridgeRpcRequest,
  CatalogBridgeRpcResponse,
  CatalogBridgeServerMessage,
} from "../../types/catalog-bridge.js";

export const catalogBridgeProtocol = 1 as const;
export const catalogBridgePath = "/__catalog/ws";
export const catalogBridgeSessionKey = "todo-list:catalog-bridge-page-id";

const methods = new Set<CatalogBridgeMethod>([
  "catalog.snapshot",
  "catalog.entity.get",
  "catalog.entity.create",
  "catalog.entity.update",
  "catalog.entity.delete",
  "catalog.completion.set",
  "catalog.batch",
]);

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseJsonMessage = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("消息不是有效的 JSON");
  }
};

export const parseCatalogBridgeRpcRequest = (
  value: unknown,
): CatalogBridgeRpcRequest => {
  if (!isObject(value)) throw new Error("请求必须是对象");
  if (value.type !== undefined && value.type !== "request") {
    throw new Error("请求 type 必须是 request");
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new Error("请求 id 必须是非空字符串");
  }
  if (
    typeof value.method !== "string" ||
    !methods.has(value.method as CatalogBridgeMethod)
  ) {
    throw new Error("请求 method 不受支持");
  }
  if (!isObject(value.params)) throw new Error("请求 params 必须是对象");
  return {
    type: "request",
    id: value.id,
    method: value.method,
    params: value.params,
  } as CatalogBridgeRpcRequest;
};

const parseCatalogBridgeRegisterMessage = (
  value: unknown,
): CatalogBridgeRegisterMessage => {
  if (!isObject(value) || value.type !== "register") {
    throw new Error("首条消息必须是 register");
  }
  if (value.protocol !== catalogBridgeProtocol) {
    throw new Error("协议版本不受支持");
  }
  if (typeof value.pageId !== "string" || value.pageId.length === 0) {
    throw new Error("pageId 必须是非空字符串");
  }
  return {
    type: "register",
    protocol: catalogBridgeProtocol,
    pageId: value.pageId,
  };
};

const parseCatalogBridgeRpcResponse = (
  value: unknown,
): CatalogBridgeRpcResponse => {
  if (!isObject(value) || value.type !== "response") {
    throw new Error("响应 type 必须是 response");
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new Error("响应 id 必须是非空字符串");
  }
  if (value.ok === true) {
    return { type: "response", id: value.id, ok: true, result: value.result };
  }
  if (value.ok !== false || !isObject(value.error)) {
    throw new Error("失败响应必须包含 error");
  }
  if (
    typeof value.error.code !== "string" ||
    typeof value.error.message !== "string"
  ) {
    throw new Error("响应 error 格式无效");
  }
  return {
    type: "response",
    id: value.id,
    ok: false,
    error: { code: value.error.code, message: value.error.message },
  };
};

export const parseCatalogBridgePageMessage = (
  value: unknown,
): CatalogBridgePageMessage => {
  if (isObject(value) && value.type === "register") {
    return parseCatalogBridgeRegisterMessage(value);
  }
  return parseCatalogBridgeRpcResponse(value);
};

export const parseCatalogBridgeServerMessage = (
  value: unknown,
): CatalogBridgeServerMessage => {
  if (isObject(value) && value.type === "ready") {
    if (
      value.protocol !== catalogBridgeProtocol ||
      typeof value.pageId !== "string"
    ) {
      throw new Error("ready 消息格式无效");
    }
    return {
      type: "ready",
      protocol: catalogBridgeProtocol,
      pageId: value.pageId,
    };
  }
  return parseCatalogBridgeRpcRequest(value);
};
