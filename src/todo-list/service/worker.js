import router from "./router.js";
import { start, stop } from "./control.js";

const log = console.log.bind(console, "%c[worker]", "color: lightblue;");

self.addEventListener("message", (event) => {
  const data = event.data || [];

  if (data === "start") {
    start();
    return;
  }

  if (data === "stop") {
    stop();
    return;
  }

  const [id, api, params] = data;
  log("receive messsage", id, api, params);

  const handle = router.get(api);
  if (handle) {
    handle(id, params);
  } else {
    self.postMessage([id, { error: `API "${api}" not defined` }]);
  }
});
