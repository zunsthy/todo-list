import type { StoredTodoItem } from "./todo-list.js";

export type StoreName = "items";

export interface StoreSnapshot {
  items: StoredTodoItem[];
}

export interface MutationParams {
  storeName: StoreName;
  dataList: StoredTodoItem[];
}

interface ServiceContract {
  all: { params: Record<string, never>; result: StoreSnapshot };
  add: { params: MutationParams; result: void };
  update: { params: MutationParams; result: void };
}

export type ServiceApi = keyof ServiceContract;
export type ServiceParams<Api extends ServiceApi> =
  ServiceContract[Api]["params"];
export type ServiceResult<Api extends ServiceApi> =
  ServiceContract[Api]["result"];

export type ServiceCallback<Api extends ServiceApi> = (
  error: Error | null,
  data?: ServiceResult<Api>,
) => void;

export type InvokeService = <Api extends ServiceApi>(
  api: Api,
  params: ServiceParams<Api>,
  callback: ServiceCallback<Api>,
) => void;

export type ServiceRequest = {
  [Api in ServiceApi]: {
    type: "request";
    id: string;
    api: Api;
    params: ServiceParams<Api>;
  };
}[ServiceApi];

export interface SerializedError {
  name: string;
  message: string;
}

export type WorkerCommand =
  { type: "start" } | { type: "stop" } | ServiceRequest;

export type WorkerResponse =
  | { type: "ready"; error?: SerializedError }
  | {
      type: "response";
      id: string;
      error?: SerializedError;
      data?: unknown;
    };

export type Respond = (response: WorkerResponse) => void;
export type PendingCallback = (error: Error | null, data?: unknown) => void;

export interface WorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<WorkerCommand>) => void,
  ): void;
  postMessage(message: WorkerResponse): void;
}
