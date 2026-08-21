import { start, stop } from "./control.js";
import { route } from "./router.js";
import type { WorkerResponse, WorkerScope } from "../../types/service.js";

const workerScope = globalThis as unknown as WorkerScope;
const respond = (message: WorkerResponse): void =>
  workerScope.postMessage(message);

workerScope.addEventListener("message", (event) => {
  const command = event.data;

  if (command.type === "start") {
    start(respond);
    return;
  }

  if (command.type === "stop") {
    stop();
    return;
  }

  route(command, respond);
});
