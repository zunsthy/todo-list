import type { CatalogBridgeRpcRequest } from "../../types/catalog-bridge.js";
import type { CatalogSnapshot } from "../../types/catalog.js";
import * as database from "../db/index.js";
import {
  applyCatalogBridgeOperations,
  findCatalogBridgeEntity,
} from "./catalog.js";
import { isObject } from "./protocol.js";

const loadSnapshot = (): Promise<CatalogSnapshot> =>
  new Promise((resolve, reject) => {
    database.loadAll((error, snapshot) => {
      if (error) reject(error);
      else if (snapshot) resolve(snapshot);
      else reject(new Error("The database returned no catalog data"));
    });
  });

const replaceSnapshot = (snapshot: CatalogSnapshot): Promise<void> =>
  new Promise((resolve, reject) => {
    database.replaceCatalog(snapshot, (error) => {
      if (error) reject(error);
      else resolve();
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
  snapshot: CatalogSnapshot,
  operations: readonly unknown[],
  onChanged: () => void,
) => {
  const applied = applyCatalogBridgeOperations(snapshot, operations);
  await replaceSnapshot(applied.snapshot);
  onChanged();
  return applied.results;
};

export const routeCatalogBridgeRequest = async (
  request: CatalogBridgeRpcRequest,
  onChanged: () => void,
): Promise<unknown> => {
  const snapshot = await loadSnapshot();
  switch (request.method) {
    case "catalog.snapshot":
      return snapshot;
    case "catalog.entity.get":
      return findCatalogBridgeEntity(snapshot, request.params);
    case "catalog.entity.create": {
      const result = await apply(
        snapshot,
        [{ ...request.params, action: "create" }],
        onChanged,
      );
      return result[0];
    }
    case "catalog.entity.update": {
      const result = await apply(
        snapshot,
        [{ ...request.params, action: "update" }],
        onChanged,
      );
      return result[0];
    }
    case "catalog.entity.delete": {
      const result = await apply(
        snapshot,
        [{ ...request.params, action: "delete" }],
        onChanged,
      );
      return result[0];
    }
    case "catalog.completion.set": {
      const result = await apply(
        snapshot,
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
      return apply(snapshot, params.operations, onChanged);
    }
  }
};
