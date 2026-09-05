import type {
  CatalogEntityStoreName,
  CatalogRecordTarget,
  CatalogStoreRecords,
  CompletionMapping,
} from "./catalog.js";

export type CatalogBridgeStatus =
  "disabled" | "connecting" | "connected" | "reconnecting" | "error";

interface CatalogBridgeWorkCreateData {
  id?: string;
  title: string;
  coverUrl?: string;
  aliases?: string[];
  authors?: string[];
  otherInfo?: string;
}

interface CatalogBridgePublicationCreateData {
  id?: string;
  workId: string;
  category: string;
  timelineGroup?: string;
  title: string;
  subtitle?: string;
  date?: string;
  endDate?: string;
  isbn?: string;
}

interface CatalogBridgeEpisodeCreateData {
  id?: string;
  publicationId: string;
  number: string;
  title: string;
  date?: string;
}

type CatalogBridgeCreateParams =
  | { storeName: "works"; data: CatalogBridgeWorkCreateData }
  | { storeName: "publications"; data: CatalogBridgePublicationCreateData }
  | { storeName: "episodes"; data: CatalogBridgeEpisodeCreateData };

type CatalogBridgeUpdateParams = {
  [Store in CatalogEntityStoreName]: {
    storeName: Store;
    id: string;
    changes: Partial<Omit<CatalogStoreRecords[Store], "id">>;
  };
}[CatalogEntityStoreName];

interface CatalogBridgeCompletionParams {
  id: string;
  completed: boolean;
}

type WithAction<Value, Action extends string> = Value extends unknown
  ? Value & { action: Action }
  : never;

type CatalogBridgeBatchOperation =
  | WithAction<CatalogBridgeCreateParams, "create">
  | WithAction<CatalogBridgeUpdateParams, "update">
  | (CatalogRecordTarget & { action: "delete" })
  | (CatalogBridgeCompletionParams & { action: "setCompletion" });

export type CatalogBridgeEntityResult = {
  [Store in CatalogEntityStoreName]: {
    storeName: Store;
    record: CatalogStoreRecords[Store];
  };
}[CatalogEntityStoreName];

export type CatalogBridgeOperationResult =
  | ({ action: "create" | "update" } & CatalogBridgeEntityResult)
  | ({ action: "delete" } & CatalogRecordTarget)
  | ({ action: "setCompletion" } & CompletionMapping);

interface CatalogBridgeParams {
  "catalog.snapshot": Record<string, never>;
  "catalog.entity.get": CatalogRecordTarget;
  "catalog.entity.create": CatalogBridgeCreateParams;
  "catalog.entity.update": CatalogBridgeUpdateParams;
  "catalog.entity.delete": CatalogRecordTarget;
  "catalog.completion.set": CatalogBridgeCompletionParams;
  "catalog.batch": { operations: CatalogBridgeBatchOperation[] };
}

export type CatalogBridgeMethod = keyof CatalogBridgeParams;

export type CatalogBridgeRpcRequest = {
  [Method in CatalogBridgeMethod]: {
    type: "request";
    id: string;
    method: Method;
    params: CatalogBridgeParams[Method];
  };
}[CatalogBridgeMethod];

export interface CatalogBridgeRpcError {
  code: string;
  message: string;
}

export type CatalogBridgeRpcResponse =
  | { type: "response"; id: string; ok: true; result: unknown }
  | { type: "response"; id: string; ok: false; error: CatalogBridgeRpcError };

export interface CatalogBridgeRegisterMessage {
  type: "register";
  protocol: 1;
  pageId: string;
}

export interface CatalogBridgeReadyMessage {
  type: "ready";
  protocol: 1;
  pageId: string;
}

export type CatalogBridgePageMessage =
  CatalogBridgeRegisterMessage | CatalogBridgeRpcResponse;

export type CatalogBridgeServerMessage =
  CatalogBridgeReadyMessage | CatalogBridgeRpcRequest;

export interface CatalogBridgePageInfo {
  pageId: string;
  connectedAt: string;
}

export type CatalogBridgeWorkerCommand =
  | { type: "bridge-connect"; url: string; pageId: string }
  | { type: "bridge-disconnect" };

export type CatalogBridgeWorkerEvent =
  | {
      type: "bridge-status";
      status: CatalogBridgeStatus;
      pageId?: string;
      error?: string;
    }
  | { type: "catalog-changed" };
