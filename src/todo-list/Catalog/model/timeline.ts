import type {
  CatalogPublication,
  CatalogTimelineModel,
  CatalogWork,
  TimelineEntry,
  TimelineGroup,
  TimelineItem,
  TimelineTrack,
  WorkTimeline,
} from "../../../types/catalog.js";

const colors = [
  "#4f7cac",
  "#8b5fbf",
  "#d66b5d",
  "#3c9d78",
  "#d2983d",
  "#5e78c7",
  "#b35c91",
];

const discreteEpisodeCategories = new Set([
  "小说",
  "movie",
  "ova",
  "oad",
]);

const toQuarter = (date: string | undefined): number | null => {
  const match = date?.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return year * 4 + Math.floor((month - 1) / 3);
};

const datedEpisodes = (publication: CatalogPublication) =>
  publication.episodes
    .flatMap((episode) => {
      const quarter = toQuarter(episode.date);
      return quarter === null ? [] : [{ episode, quarter }];
    })
    .sort(
      (left, right) =>
        left.quarter - right.quarter ||
        left.episode.date.localeCompare(right.episode.date),
    );

const publicationEndDate = (
  publication: CatalogPublication,
): string | undefined => {
  const dates = [
    publication.endDate,
    ...publication.episodes.map(({ date }) => date),
  ]
    .flatMap((date) => {
      const quarter = toQuarter(date);
      return quarter === null || !date ? [] : [{ date, quarter }];
    })
    .sort(
      (left, right) =>
        left.quarter - right.quarter || left.date.localeCompare(right.date),
    );
  return dates[dates.length - 1]?.date;
};

const publicationItem = (publication: CatalogPublication): TimelineItem => {
  const episodes = datedEpisodes(publication);
  const date =
    toQuarter(publication.date) === null
      ? (episodes[0]?.episode.date ?? publication.date)
      : publication.date;
  const endDate = publicationEndDate(publication);
  return {
    key: publication.id,
    target: { storeName: "publications", id: publication.id },
    title: publication.title,
    subtitle: publication.subtitle,
    date,
    ...(endDate && endDate !== date ? { endDate } : {}),
    completed: publication.completed,
    completedEpisodes: publication.episodes.filter(({ completed }) => completed)
      .length,
    episodeCount: publication.episodes.length,
  };
};

const discreteItems = (publication: CatalogPublication): TimelineItem[] =>
  publication.episodes.map((episode) => ({
    key: episode.id,
    target: { storeName: "episodes", id: episode.id },
    title: episode.title,
    subtitle: [publication.title, episode.number].filter(Boolean).join(" · "),
    date: episode.date,
    completed: episode.completed,
    completedEpisodes: 0,
    episodeCount: 0,
  }));

const episodeNumber = (number: string): number | null => {
  const value = number.trim();
  return /^\d+(?:\.5)?$/.test(value) ? Number(value) : null;
};

const hasContinuousEpisodeNumbers = (
  episodes: ReturnType<typeof datedEpisodes>,
): boolean =>
  episodes.length === 1 ||
  episodes.every(({ episode }, index) => {
    const current = episodeNumber(episode.number);
    if (current === null) return false;
    if (index === 0) return true;
    const previous = episodeNumber(episodes[index - 1]!.episode.number);
    if (previous === null) return false;
    const difference = current - previous;
    return difference === 0.5 || difference === 1;
  });

const animationItems = (publication: CatalogPublication): TimelineItem[] => {
  const episodes = datedEpisodes(publication);
  if (episodes.length === 0) return [publicationItem(publication)];

  const segments: (typeof episodes)[] = [];
  for (const episode of episodes) {
    const segment = segments[segments.length - 1];
    const previous = segment?.[segment.length - 1];
    if (!segment || (previous && episode.quarter - previous.quarter > 1)) {
      segments.push([episode]);
    } else {
      segment.push(episode);
    }
  }
  if (segments.length === 1 || !segments.every(hasContinuousEpisodeNumbers)) {
    return [publicationItem(publication)];
  }

  return segments.map((segment, index) => {
    const first = segment[0]!.episode;
    const last = segment[segment.length - 1]!.episode;
    if (segment.length === 1) {
      return {
        key: first.id,
        target: { storeName: "episodes", id: first.id },
        title: first.title,
        subtitle: [publication.subtitle, first.number]
          .filter(Boolean)
          .join(" · "),
        date: first.date,
        completed: first.completed,
        completedEpisodes: 0,
        episodeCount: 0,
      };
    }
    return {
      key: `${publication.id}:segment:${index}`,
      target: { storeName: "publications", id: publication.id },
      title: publication.title,
      subtitle: publication.subtitle,
      date: first.date,
      ...(last.date !== first.date ? { endDate: last.date } : {}),
      completed: publication.completed,
      completedEpisodes: segment.filter(({ episode }) => episode.completed)
        .length,
      episodeCount: segment.length,
    };
  });
};

const timelineItems = (publication: CatalogPublication): TimelineItem[] => {
  const category = publication.category.trim().toLocaleLowerCase();
  if (
    publication.episodes.length > 0 &&
    discreteEpisodeCategories.has(category)
  ) {
    return discreteItems(publication);
  }
  if (category.includes("动画")) return animationItems(publication);
  return [publicationItem(publication)];
};

const categoryColor = (category: string): string => {
  const hash = [...category].reduce(
    (value, character) => value + character.codePointAt(0)!,
    0,
  );
  return colors[hash % colors.length]!;
};

const canShareQuarterCell = (entry: TimelineEntry): boolean =>
  entry.span === 1 &&
  entry.items.every(
    ({ target, episodeCount }) =>
      target.storeName === "episodes" ||
      (target.storeName === "publications" && episodeCount === 0),
  );

const mergeQuarterEntries = (entries: TimelineEntry[]): TimelineEntry[] => {
  const merged: TimelineEntry[] = [];
  for (const entry of entries) {
    const cell = canShareQuarterCell(entry)
      ? merged.find(
          (candidate) =>
            candidate.startColumn === entry.startColumn &&
            canShareQuarterCell(candidate),
        )
      : undefined;
    if (cell) {
      cell.items.push(...entry.items);
    } else {
      merged.push({ ...entry, items: [...entry.items] });
    }
  }
  return merged;
};

const packLanes = (entries: TimelineEntry[]): TimelineGroup["lanes"] => {
  const lanes: TimelineGroup["lanes"] = [];

  for (const entry of mergeQuarterEntries(entries).sort(
    (left, right) => left.startColumn - right.startColumn,
  )) {
    const lane = lanes.find(({ entries: laneEntries }) => {
      const last = laneEntries[laneEntries.length - 1];
      return !last || last.startColumn + last.span <= entry.startColumn;
    });

    if (lane) {
      lane.entries.push(entry);
    } else {
      lanes.push({ entries: [entry] });
    }
  }

  return lanes;
};

export const buildTimeline = (
  catalogWorks: readonly CatalogWork[],
  currentYear = new Date().getFullYear(),
): CatalogTimelineModel => {
  const startYear = Math.max(2000, currentYear);
  const endYear = 2000;
  const newestQuarter = startYear * 4 + 3;
  const oldestQuarter = endYear * 4;
  const quarterCount = (startYear - endYear + 1) * 4;

  const works: WorkTimeline[] = catalogWorks.map((work) => {
    const tracks = new Map<string, Map<string, TimelineEntry[]>>();
    const undated: TimelineItem[] = [];

    for (const publication of work.publications) {
      for (const item of timelineItems(publication)) {
        const start = toQuarter(item.date);
        const end = toQuarter(item.endDate) ?? start;
        if (
          start === null ||
          end === null ||
          start > newestQuarter ||
          end < oldestQuarter
        ) {
          undated.push(item);
          continue;
        }

        const visibleStart = Math.max(start, oldestQuarter);
        const visibleEnd = Math.min(end, newestQuarter);
        const groups = tracks.get(publication.category) ?? new Map();
        const groupName = publication.timelineGroup?.trim() || "默认";
        const entries = groups.get(groupName) ?? [];
        entries.push({
          items: [item],
          startColumn: newestQuarter - visibleEnd + 1,
          span: visibleEnd - visibleStart + 1,
          color: categoryColor(publication.category),
        });
        groups.set(groupName, entries);
        tracks.set(publication.category, groups);
      }
    }

    return {
      work,
      tracks: [...tracks]
        .sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
        .map<TimelineTrack>(([category, groups]) => ({
          category,
          groups: [...groups]
            .sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
            .map(([name, entries]) => ({ name, lanes: packLanes(entries) })),
        })),
      undated,
    };
  });

  return {
    startYear,
    endYear,
    quarterCount,
    years: Array.from({ length: startYear - endYear + 1 }, (_, index) => ({
      year: startYear - index,
      startColumn: index * 4 + 1,
    })),
    works,
  };
};
