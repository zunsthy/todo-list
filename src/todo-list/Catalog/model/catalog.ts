import type {
  CatalogImportData,
  CatalogMutation,
  CatalogPublication,
  CatalogRecordMutation,
  CatalogRecordTarget,
  CatalogSnapshot,
  CatalogWork,
  Episode,
  Publication,
} from "../../../types/catalog.js";

const compareText = new Intl.Collator("zh-CN", { numeric: true }).compare;

const comparePublications = (left: Publication, right: Publication): number =>
  compareText(left.date || "9999", right.date || "9999") ||
  compareText(left.title, right.title);

const compareEpisodes = (left: Episode, right: Episode): number =>
  compareText(left.number, right.number) ||
  compareText(left.date || "9999", right.date || "9999");

export const buildCatalog = (snapshot: CatalogSnapshot): CatalogWork[] => {
  const completion = new Map(
    snapshot.completion.map(({ id, completed }) => [id, completed]),
  );
  const episodes = new Map<string, CatalogPublication["episodes"]>();
  for (const episode of snapshot.episodes) {
    const list = episodes.get(episode.publicationId) ?? [];
    list.push({ ...episode, completed: completion.get(episode.id) ?? false });
    episodes.set(episode.publicationId, list);
  }
  for (const list of episodes.values()) list.sort(compareEpisodes);

  const publications = new Map<string, CatalogPublication[]>();
  for (const publication of snapshot.publications) {
    const list = publications.get(publication.workId) ?? [];
    list.push({
      ...publication,
      completed: completion.get(publication.id) ?? false,
      episodes: episodes.get(publication.id) ?? [],
    });
    publications.set(publication.workId, list);
  }
  for (const list of publications.values()) list.sort(comparePublications);

  return [...snapshot.works]
    .sort((left, right) => compareText(left.title, right.title))
    .map((work) => ({
      ...work,
      completed: completion.get(work.id) ?? false,
      publications: publications.get(work.id) ?? [],
    }));
};

export const appendCatalogRecord = (
  snapshot: CatalogSnapshot,
  mutation: CatalogRecordMutation,
): CatalogSnapshot => {
  switch (mutation.storeName) {
    case "works":
      return {
        ...snapshot,
        works: [...snapshot.works, ...mutation.dataList],
        completion: [
          ...snapshot.completion,
          ...mutation.dataList.map(({ id }) => ({ id, completed: false })),
        ],
      };
    case "publications":
      return {
        ...snapshot,
        publications: [...snapshot.publications, ...mutation.dataList],
        completion: [
          ...snapshot.completion,
          ...mutation.dataList.map(({ id }) => ({ id, completed: false })),
        ],
      };
    case "episodes":
      return {
        ...snapshot,
        episodes: [...snapshot.episodes, ...mutation.dataList],
        completion: [
          ...snapshot.completion,
          ...mutation.dataList.map(({ id }) => ({ id, completed: false })),
        ],
      };
  }
};

const upsertRecords = <Record extends { id: string }>(
  current: readonly Record[],
  updates: readonly Record[],
): Record[] => {
  const updatesById = new Map(updates.map((record) => [record.id, record]));
  const currentIds = new Set(current.map(({ id }) => id));
  return [
    ...current.map((record) => updatesById.get(record.id) ?? record),
    ...[...updatesById.values()].filter(({ id }) => !currentIds.has(id)),
  ];
};

export const updateCatalogRecord = (
  snapshot: CatalogSnapshot,
  mutation: CatalogMutation,
): CatalogSnapshot => {
  switch (mutation.storeName) {
    case "works":
      return {
        ...snapshot,
        works: upsertRecords(snapshot.works, mutation.dataList),
      };
    case "publications":
      return {
        ...snapshot,
        publications: upsertRecords(snapshot.publications, mutation.dataList),
      };
    case "episodes":
      return {
        ...snapshot,
        episodes: upsertRecords(snapshot.episodes, mutation.dataList),
      };
    case "completion":
      return {
        ...snapshot,
        completion: upsertRecords(snapshot.completion, mutation.dataList),
      };
  }
};

export const mergeCatalogSnapshot = (
  snapshot: CatalogSnapshot,
  data: CatalogImportData,
): CatalogSnapshot => {
  const importedCompletion = data.completion ?? [];
  const completionIds = new Set([
    ...snapshot.completion.map(({ id }) => id),
    ...importedCompletion.map(({ id }) => id),
  ]);
  const entityIds = [
    ...(data.works ?? []),
    ...(data.publications ?? []),
    ...(data.episodes ?? []),
  ].map(({ id }) => id);
  const defaultCompletion = entityIds
    .filter((id) => !completionIds.has(id))
    .map((id) => ({ id, completed: false }));

  return {
    works: data.works
      ? upsertRecords(snapshot.works, data.works)
      : snapshot.works,
    publications: data.publications
      ? upsertRecords(snapshot.publications, data.publications)
      : snapshot.publications,
    episodes: data.episodes
      ? upsertRecords(snapshot.episodes, data.episodes)
      : snapshot.episodes,
    completion: upsertRecords(snapshot.completion, [
      ...defaultCompletion,
      ...importedCompletion,
    ]),
  };
};

export const removeCatalogRecord = (
  snapshot: CatalogSnapshot,
  target: CatalogRecordTarget,
): CatalogSnapshot => {
  const removedIds = new Set([target.id]);
  let works = snapshot.works;
  let publications = snapshot.publications;
  let episodes = snapshot.episodes;

  if (target.storeName === "works") {
    const publicationIds = new Set(
      publications
        .filter(({ workId }) => workId === target.id)
        .map(({ id }) => id),
    );
    for (const id of publicationIds) removedIds.add(id);
    for (const episode of episodes) {
      if (publicationIds.has(episode.publicationId)) removedIds.add(episode.id);
    }
    works = works.filter(({ id }) => id !== target.id);
    publications = publications.filter(({ id }) => !publicationIds.has(id));
    episodes = episodes.filter(({ id }) => !removedIds.has(id));
  } else if (target.storeName === "publications") {
    for (const episode of episodes) {
      if (episode.publicationId === target.id) removedIds.add(episode.id);
    }
    publications = publications.filter(({ id }) => id !== target.id);
    episodes = episodes.filter(({ id }) => !removedIds.has(id));
  } else {
    episodes = episodes.filter(({ id }) => id !== target.id);
  }

  return {
    works,
    publications,
    episodes,
    completion: snapshot.completion.filter(({ id }) => !removedIds.has(id)),
  };
};
