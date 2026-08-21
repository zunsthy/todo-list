import * as database from "../db/index.js";
import type { Respond } from "../../types/service.js";
import { serializeError } from "./error.js";

export const start = (respond: Respond): void => {
  database.open((error) => {
    respond(
      error
        ? { type: "ready", error: serializeError(error) }
        : { type: "ready" },
    );
  });
};

export const stop = (): void => {
  database.close();
};
