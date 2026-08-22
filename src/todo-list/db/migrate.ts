import type {
  CatalogSnapshot,
  CompletionMapping,
  Episode,
  Publication,
  Work,
} from "../../types/catalog.js";
import type { LegacyTodoItem } from "../../types/database.js";

const categoryLabels: Record<string, string> = {
  animation: "动画",
  comic: "漫画",
  game: "游戏",
  novel: "小说",
};

const toEpisode = (item: LegacyTodoItem, publicationId: string): Episode => {
  const name = item.name?.trim() || item.id;
  const match = name.match(
    /^(?:第\s*)?([0-9]+|EX)(?:\s*[集话])?(?:\s*[-—:：]\s*)?(.*)$/i,
  );
  return {
    id: item.id,
    publicationId,
    number: match?.[1] ?? "",
    title: match?.[2]?.trim() || name,
    date: item.date ?? "",
  };
};

export const migrateLegacyItems = (
  items: readonly LegacyTodoItem[],
  createId: () => string = () => crypto.randomUUID(),
): CatalogSnapshot => {
  const table = new Map(items.map((item) => [item.id, item]));
  const roots = new Set(items.filter((item) => !item.pid).map(({ id }) => id));
  const workIds = new Map<string, string>();
  const publicationIds = new Map<string, string>();
  const works: Work[] = [];
  const publications: Publication[] = [];
  const episodes: Episode[] = [];
  const completion: CompletionMapping[] = [];

  for (const item of items) {
    if (!roots.has(item.id)) continue;
    const id = createId();
    workIds.set(item.id, id);
    works.push({
      id,
      title: item.name?.trim() || item.id,
      coverUrl: "",
      aliases: [],
      authors: [],
      otherInfo: "",
    });
    completion.push({ id, completed: false });
  }

  for (const item of items) {
    if (!item.pid || !roots.has(item.pid)) continue;
    const workId = workIds.get(item.pid);
    if (!workId) continue;
    const id = createId();
    publicationIds.set(item.id, id);
    publications.push({
      id,
      workId,
      category: categoryLabels[item.category ?? ""] ?? item.category ?? "其他",
      timelineGroup: "",
      title: item.name?.trim() || item.id,
      subtitle: item.series?.trim() ?? "",
      date: item.date ?? "",
      endDate: "",
      isbn: "",
    });
    completion.push({ id, completed: false });
  }

  for (const item of items) {
    if (!item.pid || roots.has(item.id) || publicationIds.has(item.id)) {
      continue;
    }

    let legacyPublicationId: string | undefined = item.pid;
    while (legacyPublicationId && !publicationIds.has(legacyPublicationId)) {
      legacyPublicationId = table.get(legacyPublicationId)?.pid;
    }
    if (!legacyPublicationId) continue;

    const id = createId();
    episodes.push({
      ...toEpisode(item, publicationIds.get(legacyPublicationId)!),
      id,
    });
    completion.push({ id, completed: false });
  }

  return { works, publications, episodes, completion };
};
