import type {
  CatalogImportData,
  CatalogImportScope,
  CatalogSnapshot,
  CatalogTransferDocument,
  CompletionMapping,
  Episode,
  Publication,
  Work,
} from "../../../types/catalog.js";

const invalid = (message: string): never => {
  throw new Error(`导入数据无效：${message}`);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const objectValue = (value: unknown, label: string): Record<string, unknown> =>
  isObject(value) ? value : invalid(`${label} 必须是对象`);

const listValue = (value: unknown, label: string): unknown[] =>
  Array.isArray(value) ? value : invalid(`${label} 必须是数组`);

const stringValue = (
  record: Record<string, unknown>,
  key: string,
  label: string,
): string =>
  typeof record[key] === "string"
    ? record[key]
    : invalid(`${label}.${key} 必须是字符串`);

const stringValueOr = (
  record: Record<string, unknown>,
  key: string,
  label: string,
  fallback: string,
): string =>
  record[key] === undefined ? fallback : stringValue(record, key, label);

const optionalStringValue = (
  record: Record<string, unknown>,
  key: string,
  label: string,
): string | undefined => {
  const value = record[key];
  return value === undefined || typeof value === "string"
    ? value
    : invalid(`${label}.${key} 必须是字符串`);
};

const stringListValue = (
  record: Record<string, unknown>,
  key: string,
  label: string,
): string[] => {
  const value = record[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : invalid(`${label}.${key} 必须是字符串数组`);
};

const stringListValueOrEmpty = (
  record: Record<string, unknown>,
  key: string,
  label: string,
): string[] =>
  record[key] === undefined ? [] : stringListValue(record, key, label);

const parseStoredWork = (value: unknown, index: number): Work => {
  const label = `works[${index}]`;
  const record = objectValue(value, label);
  const coverUrl = optionalStringValue(record, "coverUrl", label);
  return {
    id: stringValue(record, "id", label),
    title: stringValue(record, "title", label),
    ...(coverUrl === undefined ? {} : { coverUrl }),
    aliases: stringListValue(record, "aliases", label),
    authors: stringListValue(record, "authors", label),
    otherInfo: stringValue(record, "otherInfo", label),
  };
};

const parseStoredPublication = (value: unknown, index: number): Publication => {
  const label = `publications[${index}]`;
  const record = objectValue(value, label);
  const timelineGroup = optionalStringValue(record, "timelineGroup", label);
  const endDate = optionalStringValue(record, "endDate", label);
  return {
    id: stringValue(record, "id", label),
    workId: stringValue(record, "workId", label),
    category: stringValue(record, "category", label),
    ...(timelineGroup === undefined ? {} : { timelineGroup }),
    title: stringValue(record, "title", label),
    subtitle: stringValue(record, "subtitle", label),
    date: stringValue(record, "date", label),
    ...(endDate === undefined ? {} : { endDate }),
    isbn: stringValue(record, "isbn", label),
  };
};

const parseStoredEpisode = (value: unknown, index: number): Episode => {
  const label = `episodes[${index}]`;
  const record = objectValue(value, label);
  return {
    id: stringValue(record, "id", label),
    publicationId: stringValue(record, "publicationId", label),
    number: stringValue(record, "number", label),
    title: stringValue(record, "title", label),
    date: stringValue(record, "date", label),
  };
};

const parseCompletion = (value: unknown, index: number): CompletionMapping => {
  const label = `completion[${index}]`;
  const record = objectValue(value, label);
  const completed =
    typeof record.completed === "boolean"
      ? record.completed
      : invalid(`${label}.completed 必须是布尔值`);
  return {
    id: stringValue(record, "id", label),
    completed,
  };
};

const parseList = <Record extends { id: string }>(
  value: unknown,
  label: string,
  parse: (item: unknown, index: number) => Record,
): Record[] => {
  const records = listValue(value, label).map(parse);
  const ids = new Set<string>();
  for (const record of records) {
    if (!record.id) invalid(`${label} 中的 id 不能为空`);
    if (ids.has(record.id)) invalid(`${label} 中存在重复 id：${record.id}`);
    ids.add(record.id);
  }
  return records;
};

const transferData = (value: unknown): Record<string, unknown> => {
  const document = objectValue(value, "根节点");
  if (document.format !== "todo-list-catalog") {
    invalid("format 必须是 todo-list-catalog");
  }
  if (document.version !== 1) invalid("只支持 version 1");
  if (typeof document.exportedAt !== "string") {
    invalid("exportedAt 必须是字符串");
  }
  return objectValue(document.data, "data");
};

const isTransferDocument = (value: unknown): boolean =>
  isObject(value) && ("format" in value || "version" in value);

const parseStoredData = (
  value: unknown,
  scope: CatalogImportScope,
): CatalogImportData => {
  const source = transferData(value);
  if (scope === "all") {
    return {
      works: parseList(source.works, "works", parseStoredWork),
      publications: parseList(
        source.publications,
        "publications",
        parseStoredPublication,
      ),
      episodes: parseList(source.episodes, "episodes", parseStoredEpisode),
      ...(source.completion === undefined
        ? {}
        : {
            completion: parseList(
              source.completion,
              "completion",
              parseCompletion,
            ),
          }),
    };
  }

  switch (scope) {
    case "works":
      return { works: parseList(source.works, scope, parseStoredWork) };
    case "publications":
      return {
        publications: parseList(
          source.publications,
          scope,
          parseStoredPublication,
        ),
      };
    case "episodes":
      return {
        episodes: parseList(source.episodes, scope, parseStoredEpisode),
      };
    case "completion":
      return {
        completion: parseList(source.completion, scope, parseCompletion),
      };
  }
};

const createUniqueId = (
  snapshot: CatalogSnapshot | undefined,
  createId: () => string,
): (() => string) => {
  const usedIds = new Set([
    ...(snapshot?.works ?? []).map(({ id }) => id),
    ...(snapshot?.publications ?? []).map(({ id }) => id),
    ...(snapshot?.episodes ?? []).map(({ id }) => id),
  ]);

  return () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const id = createId();
      if (id && !usedIds.has(id)) {
        usedIds.add(id);
        return id;
      }
    }
    return invalid("无法生成不重复的 UUID");
  };
};

const parseExternalWork = (value: unknown, index: number, id: string): Work => {
  const label = `works[${index}]`;
  const record = objectValue(value, label);
  const coverUrl = optionalStringValue(record, "coverUrl", label);
  return {
    id,
    title: stringValue(record, "title", label),
    ...(coverUrl === undefined ? {} : { coverUrl }),
    aliases: stringListValueOrEmpty(record, "aliases", label),
    authors: stringListValueOrEmpty(record, "authors", label),
    otherInfo: stringValueOr(record, "otherInfo", label, ""),
  };
};

const parseExternalPublication = (
  value: unknown,
  index: number,
  id: string,
  workId: string,
  labelPrefix = "publications",
): Publication => {
  const label = `${labelPrefix}[${index}]`;
  const record = objectValue(value, label);
  const timelineGroup = optionalStringValue(record, "timelineGroup", label);
  const endDate = optionalStringValue(record, "endDate", label);
  return {
    id,
    workId,
    category: stringValue(record, "category", label),
    ...(timelineGroup === undefined ? {} : { timelineGroup }),
    title: stringValue(record, "title", label),
    subtitle: stringValueOr(record, "subtitle", label, ""),
    date: stringValueOr(record, "date", label, ""),
    ...(endDate === undefined ? {} : { endDate }),
    isbn: stringValueOr(record, "isbn", label, ""),
  };
};

const parseExternalEpisode = (
  value: unknown,
  index: number,
  id: string,
  publicationId: string,
  labelPrefix = "episodes",
): Episode => {
  const label = `${labelPrefix}[${index}]`;
  const record = objectValue(value, label);
  return {
    id,
    publicationId,
    number: stringValue(record, "number", label),
    title: stringValue(record, "title", label),
    date: stringValueOr(record, "date", label, ""),
  };
};

const externalList = (value: unknown, scope: string): unknown[] => {
  if (Array.isArray(value)) return value;
  return listValue(objectValue(value, "根节点")[scope], scope);
};

const parseExternalTree = (
  value: unknown,
  nextId: () => string,
): CatalogImportData => {
  if (
    isObject(value) &&
    (value.publications !== undefined || value.episodes !== undefined)
  ) {
    invalid("外部整体数据必须把 publications 和 episodes 放在所属父级中");
  }
  const source = externalList(value, "works");
  const works: Work[] = [];
  const publications: Publication[] = [];
  const episodes: Episode[] = [];

  source.forEach((workValue, workIndex) => {
    const workRecord = objectValue(workValue, `works[${workIndex}]`);
    const workId = nextId();
    works.push(parseExternalWork(workRecord, workIndex, workId));

    const publicationList =
      workRecord.publications === undefined
        ? []
        : listValue(
            workRecord.publications,
            `works[${workIndex}].publications`,
          );
    publicationList.forEach((publicationValue, publicationIndex) => {
      const publicationRecord = objectValue(
        publicationValue,
        `works[${workIndex}].publications[${publicationIndex}]`,
      );
      const publicationId = nextId();
      publications.push(
        parseExternalPublication(
          publicationRecord,
          publicationIndex,
          publicationId,
          workId,
          `works[${workIndex}].publications`,
        ),
      );

      const episodeList =
        publicationRecord.episodes === undefined
          ? []
          : listValue(
              publicationRecord.episodes,
              `works[${workIndex}].publications[${publicationIndex}].episodes`,
            );
      episodeList.forEach((episodeValue, episodeIndex) => {
        episodes.push(
          parseExternalEpisode(
            episodeValue,
            episodeIndex,
            nextId(),
            publicationId,
            `works[${workIndex}].publications[${publicationIndex}].episodes`,
          ),
        );
      });
    });
  });

  return { works, publications, episodes };
};

const parseExternalData = (
  value: unknown,
  scope: CatalogImportScope,
  snapshot: CatalogSnapshot | undefined,
  parentId: string | undefined,
  nextId: () => string,
): CatalogImportData => {
  if (scope === "all") return parseExternalTree(value, nextId);
  const source = externalList(value, scope);

  if (scope === "works") {
    return {
      works: source.map((item, index) =>
        parseExternalWork(item, index, nextId()),
      ),
    };
  }
  if (scope === "publications") {
    const workId = parentId ?? invalid("导入外部出版物时必须选择所属作品");
    if (snapshot && !snapshot.works.some(({ id }) => id === workId)) {
      invalid("所选作品不存在");
    }
    return {
      publications: source.map((item, index) =>
        parseExternalPublication(item, index, nextId(), workId),
      ),
    };
  }
  if (scope === "episodes") {
    const publicationId =
      parentId ?? invalid("导入外部集数据时必须选择所属出版物");
    if (
      snapshot &&
      !snapshot.publications.some(({ id }) => id === publicationId)
    ) {
      invalid("所选出版物不存在");
    }
    return {
      episodes: source.map((item, index) =>
        parseExternalEpisode(item, index, nextId(), publicationId),
      ),
    };
  }

  return { completion: parseList(source, scope, parseCompletion) };
};

const assertEntityIdsDoNotCollide = (
  data: CatalogImportData,
  snapshot?: CatalogSnapshot,
): void => {
  const locations = new Map<string, string>();
  const stores = ["works", "publications", "episodes"] as const;

  for (const storeName of stores) {
    for (const record of data[storeName] ?? []) {
      const existingStore = locations.get(record.id);
      if (existingStore && existingStore !== storeName) {
        invalid(`id ${record.id} 同时出现在 ${existingStore} 和 ${storeName}`);
      }
      locations.set(record.id, storeName);
    }
  }

  if (!snapshot) return;
  for (const [id, importedStore] of locations) {
    for (const storeName of stores) {
      if (
        storeName !== importedStore &&
        snapshot[storeName].some((record) => record.id === id)
      ) {
        invalid(`id ${id} 已用于 ${storeName}，不能导入到 ${importedStore}`);
      }
    }
  }
};

export const createCatalogExport = (
  snapshot: CatalogSnapshot,
  includeCompletion: boolean,
  exportedAt = new Date(),
): CatalogTransferDocument => ({
  format: "todo-list-catalog",
  version: 1,
  exportedAt: exportedAt.toISOString(),
  data: {
    works: [...snapshot.works],
    publications: [...snapshot.publications],
    episodes: [...snapshot.episodes],
    ...(includeCompletion ? { completion: [...snapshot.completion] } : {}),
  },
});

export const parseCatalogImport = (
  value: unknown,
  scope: CatalogImportScope,
  snapshot?: CatalogSnapshot,
  parentId?: string,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): CatalogImportData => {
  const data = isTransferDocument(value)
    ? parseStoredData(value, scope)
    : parseExternalData(
        value,
        scope,
        snapshot,
        parentId,
        createUniqueId(snapshot, createId),
      );
  assertEntityIdsDoNotCollide(data, snapshot);
  return data;
};
