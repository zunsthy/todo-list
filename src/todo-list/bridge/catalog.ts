import type {
  CatalogBridgeEntityResult,
  CatalogBridgeOperationResult,
} from "../../types/catalog-bridge.js";
import type {
  CatalogEntityStoreName,
  CatalogMutation,
  CatalogRecordMutation,
  CatalogRecordTarget,
  CatalogSnapshot,
  CatalogStoreRecords,
} from "../../types/catalog.js";
import {
  appendCatalogRecord,
  removeCatalogRecord,
  updateCatalogRecord,
} from "../Catalog/model/catalog.ts";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storeNames = ["works", "publications", "episodes"] as const;
const fields = {
  works: ["title", "coverUrl", "aliases", "authors", "otherInfo"],
  publications: [
    "workId",
    "category",
    "timelineGroup",
    "title",
    "subtitle",
    "date",
    "endDate",
    "isbn",
  ],
  episodes: ["publicationId", "number", "title", "date"],
} as const;
const requiredFields = {
  works: ["title", "aliases", "authors", "otherInfo"],
  publications: ["workId", "category", "title", "subtitle", "date", "isbn"],
  episodes: ["publicationId", "number", "title", "date"],
} as const;
const listFields = new Set(["aliases", "authors"]);
const nonEmptyFields = new Set([
  "title",
  "workId",
  "category",
  "publicationId",
  "number",
]);

export class CatalogBridgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CatalogBridgeError";
  }
}

const invalid = (message: string): never => {
  throw new CatalogBridgeError("INVALID_REQUEST", message);
};

const notFound = (message: string): never => {
  throw new CatalogBridgeError("NOT_FOUND", message);
};

const objectValue = (value: unknown, label: string): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid(`${label} 必须是对象`);

const text = (
  record: Record<string, unknown>,
  key: string,
  label: string,
  required = false,
): string => {
  const value = record[key];
  if (typeof value !== "string" || (required && value.trim() === "")) {
    return invalid(`${label}.${key} 必须是${required ? "非空" : ""}字符串`);
  }
  return value;
};

const assertKeys = (
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void => {
  const names = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!names.has(key)) invalid(`${label}.${key} 不是可用字段`);
  }
};

const storeName = (
  record: Record<string, unknown>,
  label: string,
): CatalogEntityStoreName => {
  const value = text(record, "storeName", label);
  return (storeNames as readonly string[]).includes(value)
    ? (value as CatalogEntityStoreName)
    : invalid(`${label}.storeName 不受支持`);
};

const target = (value: unknown): CatalogRecordTarget => {
  const record = objectValue(value, "target");
  return {
    storeName: storeName(record, "target"),
    id: text(record, "id", "target", true),
  } as CatalogRecordTarget;
};

const records = (
  snapshot: CatalogSnapshot,
  name: CatalogEntityStoreName,
): readonly { id: string }[] => snapshot[name];

export const findCatalogBridgeEntity = (
  snapshot: CatalogSnapshot,
  value: unknown,
): CatalogBridgeEntityResult => {
  const currentTarget = target(value);
  const record = records(snapshot, currentTarget.storeName).find(
    ({ id }) => id === currentTarget.id,
  );
  if (!record) {
    notFound(`找不到 ${currentTarget.storeName} 中的 ${currentTarget.id}`);
  }
  return {
    storeName: currentTarget.storeName,
    record,
  } as CatalogBridgeEntityResult;
};

const normalizeRecord = <Store extends CatalogEntityStoreName>(
  snapshot: CatalogSnapshot,
  name: Store,
  value: unknown,
  label: string,
): CatalogStoreRecords[Store] => {
  const data = objectValue(value, label);
  assertKeys(data, ["id", ...fields[name]], label);
  text(data, "id", label, true);
  for (const field of fields[name]) {
    const fieldValue = data[field];
    if (fieldValue === undefined) {
      if ((requiredFields[name] as readonly string[]).includes(field)) {
        invalid(`${label}.${field} 不能为空`);
      }
      continue;
    }
    if (listFields.has(field)) {
      if (
        !Array.isArray(fieldValue) ||
        fieldValue.some((item) => typeof item !== "string")
      ) {
        invalid(`${label}.${field} 必须是字符串数组`);
      }
    } else if (
      typeof fieldValue !== "string" ||
      (nonEmptyFields.has(field) && fieldValue.trim() === "")
    ) {
      invalid(`${label}.${field} 必须是字符串`);
    }
  }

  if (
    name === "publications" &&
    !snapshot.works.some(({ id }) => id === data.workId)
  ) {
    notFound(`找不到所属作品：${String(data.workId)}`);
  }
  if (
    name === "episodes" &&
    !snapshot.publications.some(({ id }) => id === data.publicationId)
  ) {
    notFound(`找不到所属出版物：${String(data.publicationId)}`);
  }
  return data as unknown as CatalogStoreRecords[Store];
};

const createId = (
  requested: unknown,
  snapshot: CatalogSnapshot,
  generateId: () => string,
): string => {
  const id = requested ?? generateId();
  if (typeof id !== "string" || !uuid.test(id)) {
    return invalid("新实体 id 必须是 UUID v4；省略时由页面生成");
  }
  if (
    storeNames.some((name) => snapshot[name].some((item) => item.id === id))
  ) {
    throw new CatalogBridgeError("ALREADY_EXISTS", `实体 id 已存在：${id}`);
  }
  return id;
};

const createRecord = (
  snapshot: CatalogSnapshot,
  value: unknown,
  generateId: () => string,
) => {
  const operation = objectValue(value, "create");
  assertKeys(operation, ["action", "storeName", "data"], "create");
  const name = storeName(operation, "create");
  const data = objectValue(operation.data, "create.data");
  const id = createId(data.id, snapshot, generateId);
  const defaults =
    name === "works"
      ? { aliases: [], authors: [], otherInfo: "" }
      : name === "publications"
        ? { subtitle: "", date: "", isbn: "" }
        : { date: "" };
  const record = normalizeRecord(
    snapshot,
    name,
    { ...defaults, ...data, id },
    "create.data",
  );
  return {
    snapshot: appendCatalogRecord(snapshot, {
      storeName: name,
      dataList: [record],
    } as CatalogRecordMutation),
    result: { action: "create", storeName: name, record },
  } as const;
};

const updateRecord = (snapshot: CatalogSnapshot, value: unknown) => {
  const operation = objectValue(value, "update");
  assertKeys(operation, ["action", "storeName", "id", "changes"], "update");
  const current = findCatalogBridgeEntity(snapshot, operation);
  const changes = objectValue(operation.changes, "update.changes");
  assertKeys(changes, fields[current.storeName], "update.changes");
  const record = normalizeRecord(
    snapshot,
    current.storeName,
    { ...current.record, ...changes },
    "update.changes",
  );
  return {
    snapshot: updateCatalogRecord(snapshot, {
      storeName: current.storeName,
      dataList: [record],
    } as CatalogMutation),
    result: { action: "update", storeName: current.storeName, record },
  } as const;
};

const deleteRecord = (snapshot: CatalogSnapshot, value: unknown) => {
  const operation = objectValue(value, "delete");
  assertKeys(operation, ["action", "storeName", "id"], "delete");
  const currentTarget = target(operation);
  findCatalogBridgeEntity(snapshot, currentTarget);
  return {
    snapshot: removeCatalogRecord(snapshot, currentTarget),
    result: { action: "delete", ...currentTarget },
  } as const;
};

const setCompletion = (snapshot: CatalogSnapshot, value: unknown) => {
  const operation = objectValue(value, "completion");
  assertKeys(operation, ["action", "id", "completed"], "completion");
  const id = text(operation, "id", "completion", true);
  const completedValue = operation.completed;
  if (typeof completedValue !== "boolean") {
    return invalid("completion.completed 必须是布尔值");
  }
  const completed = completedValue;
  if (
    !storeNames.some((name) => snapshot[name].some((item) => item.id === id))
  ) {
    notFound(`找不到实体：${id}`);
  }
  const mapping = { id, completed };
  const exists = snapshot.completion.some((item) => item.id === id);
  return {
    snapshot: {
      ...snapshot,
      completion: exists
        ? snapshot.completion.map((item) => (item.id === id ? mapping : item))
        : [...snapshot.completion, mapping],
    },
    result: { action: "setCompletion", ...mapping },
  } as const;
};

const applyOperation = (
  snapshot: CatalogSnapshot,
  value: unknown,
  generateId: () => string,
) => {
  const operation = objectValue(value, "operation");
  switch (operation.action) {
    case "create":
      return createRecord(snapshot, operation, generateId);
    case "update":
      return updateRecord(snapshot, operation);
    case "delete":
      return deleteRecord(snapshot, operation);
    case "setCompletion":
      return setCompletion(snapshot, operation);
    default:
      return invalid("operation.action 不受支持");
  }
};

export const applyCatalogBridgeOperations = (
  snapshot: CatalogSnapshot,
  operations: readonly unknown[],
  generateId: () => string = () => globalThis.crypto.randomUUID(),
): { snapshot: CatalogSnapshot; results: CatalogBridgeOperationResult[] } => {
  if (operations.length === 0) invalid("operations 不能为空");
  let current = snapshot;
  const results: CatalogBridgeOperationResult[] = [];
  for (const operation of operations) {
    const applied = applyOperation(current, operation, generateId);
    current = applied.snapshot;
    results.push(applied.result as CatalogBridgeOperationResult);
  }
  return { snapshot: current, results };
};
