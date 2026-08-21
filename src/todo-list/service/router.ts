import * as database from "../db/index.js";
import type { Respond, ServiceRequest } from "../../types/service.js";
import { serializeError } from "./error.js";

const respondWithError = (respond: Respond, id: string, error: Error): void => {
  respond({ type: "response", id, error: serializeError(error) });
};

export const route = (request: ServiceRequest, respond: Respond): void => {
  switch (request.api) {
    case "all":
      database.loadAll((error, data) => {
        if (error) {
          respondWithError(respond, request.id, error);
          return;
        }
        if (!data) {
          respondWithError(
            respond,
            request.id,
            new Error("The database returned no data"),
          );
          return;
        }
        respond({ type: "response", id: request.id, data });
      });
      return;

    case "add":
      database.add(
        request.params.storeName,
        request.params.dataList,
        (error) => {
          if (error) {
            respondWithError(respond, request.id, error);
            return;
          }
          respond({ type: "response", id: request.id });
        },
      );
      return;

    case "update":
      database.update(
        request.params.storeName,
        request.params.dataList,
        (error) => {
          if (error) {
            respondWithError(respond, request.id, error);
            return;
          }
          respond({ type: "response", id: request.id });
        },
      );
  }
};
