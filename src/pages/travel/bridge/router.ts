import type { BridgeRpcRequest } from "../../../shared/bridge/types.ts";
import type { TravelDatabase } from "../db.ts";
import { buildTree, filterFootprints } from "../model.ts";
import {
  mutationObject,
  TravelMutationError,
  type TravelMutationPlan,
  type TravelMutationPreview,
} from "../mutations.ts";

const notFound = (label: string): never => {
  throw new TravelMutationError("NOT_FOUND", `${label}不存在`);
};
const summarize = (plan: TravelMutationPlan) => ({
  added: plan.changes.filter((change) => !change.before).length,
  updated: plan.changes.filter((change) => change.before && change.after)
    .length,
  deleted: plan.changes.filter((change) => !change.after).length,
  warnings: plan.warnings,
  changes: plan.changes.map((change) =>
    change.store !== "regionBoundaries"
      ? change
      : {
          ...change,
          before:
            change.before && "geometry" in change.before
              ? {
                  key: change.id,
                  coordinateSystem: change.before.coordinateSystem,
                  type: change.before.geometry.type,
                }
              : null,
          after:
            change.after && "geometry" in change.after
              ? {
                  key: change.id,
                  coordinateSystem: change.after.coordinateSystem,
                  type: change.after.geometry.type,
                }
              : null,
        },
  ),
});

export const createTravelBridgeRouter = (
  database: TravelDatabase,
  onChanged: () => void,
) => {
  const previews = new Map<
    string,
    {
      preview: TravelMutationPreview;
      expiresAt: number;
      result?: Promise<unknown>;
    }
  >();
  let active = true;
  const route = async (request: BridgeRpcRequest): Promise<unknown> => {
    if (!active)
      throw new TravelMutationError("PAGE_DISCONNECTED", "足迹控制已关闭");
    const params = mutationObject(request.params);
    const text = (key: string): string => {
      const value = params[key];
      if (typeof value !== "string" || !value.trim())
        throw new TravelMutationError(
          "INVALID_REQUEST",
          `${key} 必须是非空字符串`,
        );
      return value;
    };
    switch (request.method) {
      case "travel.snapshot":
        return database.snapshot();
      case "travel.regions.get": {
        const tree = buildTree(await database.snapshot()),
          id = text("id");
        return {
          region: tree.byId.get(id) ?? notFound("地区"),
          path: tree.path(id),
          isLeaf: tree.isLeaf(id),
        };
      }
      case "travel.regions.children": {
        const tree = buildTree(await database.snapshot());
        const parentId = params.parentId == null ? null : text("parentId");
        return {
          parent:
            parentId === null
              ? null
              : (tree.byId.get(parentId) ?? notFound("父地区")),
          children: tree.children.get(parentId) ?? [],
        };
      }
      case "travel.footprints.get": {
        const id = text("id");
        return (
          (await database.snapshot()).footprints.find(
            (item) => item.id === id,
          ) ?? notFound("足迹")
        );
      }
      case "travel.footprints.list": {
        const snapshot = await database.snapshot(),
          tree = buildTree(snapshot);
        const regionId =
          params.regionId === undefined ? null : text("regionId");
        if (regionId && !tree.byId.has(regionId)) notFound("地区");
        return filterFootprints(
          snapshot.footprints,
          params.year === undefined ? "" : text("year"),
          params.visitType === undefined ? "" : text("visitType"),
        ).filter(
          (item) =>
            !regionId ||
            item.regionId === regionId ||
            (params.includeDescendants === true &&
              tree.path(item.regionId).some(({ id }) => id === regionId)),
        );
      }
      case "travel.boundaries.get":
        return (await database.getBoundary(text("key"))) ?? notFound("边界");
      case "travel.export":
        return database.export(
          params.regionId === undefined ? undefined : text("regionId"),
        );
      case "travel.mutations.preview": {
        const preview = await database.previewMutations(params.operations);
        if (!active)
          throw new TravelMutationError("PAGE_DISCONNECTED", "足迹控制已关闭");
        const now = Date.now();
        for (const [id, entry] of previews)
          if (entry.expiresAt <= now) previews.delete(id);
        if (previews.size >= 10) previews.delete(previews.keys().next().value!);
        const previewId = globalThis.crypto.randomUUID(),
          expiresAt = now + 10 * 60_000;
        previews.set(previewId, { preview, expiresAt });
        return {
          previewId,
          expiresAt: new Date(expiresAt).toISOString(),
          ...summarize(preview.plan),
        };
      }
      case "travel.mutations.commit": {
        const previewId = text("previewId"),
          entry = previews.get(previewId);
        if (!entry || entry.expiresAt <= Date.now()) {
          previews.delete(previewId);
          throw new TravelMutationError(
            "PREVIEW_EXPIRED",
            "预览不存在或已过期，请重新预览",
          );
        }
        // Store the promise before yielding; repeated commits share one transaction.
        entry.result ??= database
          .commitMutations(entry.preview)
          .then((plan) => {
            onChanged();
            return { committed: true, ...summarize(plan) };
          });
        return entry.result;
      }
      default:
        throw new TravelMutationError("INVALID_REQUEST", "不支持的足迹方法");
    }
  };
  return {
    route,
    close: () => {
      active = false;
      previews.clear();
    },
  };
};
