import * as db from "../db/index.js";

export const start = () => {
  db.open(() => {
    self.postMessage([null, true]);
  });
};

export const stop = () => {
  db.close();
  self.postMessage([null, false]);
};
