import type {
  CatalogBridgeOperationResult,
  CatalogBridgeRpcRequest,
} from "../../types/catalog-bridge.js";
import type { CatalogSnapshot } from "../../types/catalog.js";
import * as database from "../db/index.ts";
import {
  applyCatalogBridgeOperations,
  findCatalogBridgeEntity,
} from "./catalog.ts";
import { isObject } from "./protocol.ts";

const loadSnapshot = (): Promise<CatalogSnapshot> =>
  new Promise((resolve, reject) => {
    database.loadAll((error, snapshot) => {
      if (error) reject(error);
      else if (snapshot) resolve(snapshot);
      else reject(new Error("The database returned no catalog data"));
    });
  });

const objectParams = (
  value: unknown,
  label: string,
): Record<string, unknown> => {
  if (!isObject(value)) throw new Error(`${label} 必须是对象`);
  return value;
};

const apply = async (
  operations: readonly unknown[],
  onChanged: () => void,
): Promise<CatalogBridgeOperationResult[]> => {
  const results = await new Promise<CatalogBridgeOperationResult[]>(
    (resolve, reject) => {
      database.mutateCatalog(
        (snapshot) => {
          const applied = applyCatalogBridgeOperations(snapshot, operations);
          return { snapshot: applied.snapshot, result: applied.results };
        },
        (error, result) => {
          if (error) reject(error);
          else if (result) resolve(result);
          else reject(new Error("The database returned no operation results"));
        },
      );
    },
  );
  onChanged();
  return results;
};

export const routeCatalogBridgeRequest = async (
  request: CatalogBridgeRpcRequest,
  onChanged: () => void,
): Promise<unknown> => {
  switch (request.method) {
    case "catalog.snapshot":
      return loadSnapshot();
    case "catalog.entity.get":
      return findCatalogBridgeEntity(await loadSnapshot(), request.params);
    case "catalog.entity.create": {
      const result = await apply(
        [{ ...request.params, action: "create" }],
        onChanged,
      );
      return result[0];
    }
    case "catalog.entity.update": {
      const result = await apply(
        [{ ...request.params, action: "update" }],
        onChanged,
      );
      return result[0];
    }
    case "catalog.entity.delete": {
      const result = await apply(
        [{ ...request.params, action: "delete" }],
        onChanged,
      );
      return result[0];
    }
    case "catalog.completion.set": {
      const result = await apply(
        [{ ...request.params, action: "setCompletion" }],
        onChanged,
      );
      return result[0];
    }
    case "catalog.batch": {
      const params = objectParams(request.params, "params");
      if (!Array.isArray(params.operations)) {
        throw new Error("params.operations 必须是数组");
      }
      return apply(params.operations, onChanged);
    }
  }
};
