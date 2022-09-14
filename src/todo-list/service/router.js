import * as db from "../db/index.js";

const handlers = new Map();
const router = {
  delete(api) {
    handlers.delete(api);
  },
  set(api, handler) {
    handlers.set(api, handler);
  },
  get(api) {
    return handlers.get(api);
  },
};

router.set("all", (id) => {
  db.loadAll((err, data) => {
    self.postMessage([id, err, data]);
  });
});

export default router;
