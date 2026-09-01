import { start, stop } from "./control.js";
import { route } from "./router.js";
import type { WorkerResponse, WorkerScope } from "../../types/service.js";
import { createCatalogBridgeClient } from "../bridge/client.js";
import { serializeError } from "./error.js";

const workerScope = globalThis as unknown as WorkerScope;
const respond = (message: WorkerResponse): void =>
  workerScope.postMessage(message);
let bridgeEnabled = false;
const catalogBridge = createCatalogBridgeClient({
  onStatus: (status, pageId, error) =>
    respond({ type: "bridge-status", status, pageId, error }),
  onChanged: () => respond({ type: "catalog-changed" }),
});

workerScope.addEventListener("message", (event) => {
  const command = event.data;

  if (command.type === "start") {
    start(respond);
    return;
  }

  if (command.type === "stop") {
    bridgeEnabled = false;
    catalogBridge.disconnect();
    stop();
    return;
  }

  if (command.type === "bridge-connect") {
    bridgeEnabled = true;
    catalogBridge.connect(command.url, command.pageId);
    return;
  }

  if (command.type === "bridge-disconnect") {
    bridgeEnabled = false;
    catalogBridge.disconnect();
    return;
  }

  if (bridgeEnabled && command.api !== "all") {
    respond({
      type: "response",
      id: command.id,
      error: serializeError(
        new Error("当前由服务端控制数据，页面写操作已禁用"),
      ),
    });
    return;
  }

  route(command, respond);
});
