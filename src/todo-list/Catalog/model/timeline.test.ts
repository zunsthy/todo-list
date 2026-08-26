import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogWork } from "../../../types/catalog.js";
import { buildTimeline } from "./timeline.ts";

const works: CatalogWork[] = [
  {
    id: "work",
    title: "作品",
    aliases: [],
    authors: [],
    otherInfo: "",
    completed: false,
    publications: [
      {
        id: "novel",
        workId: "work",
        category: "小说",
        title: "单行本",
        subtitle: "",
        date: "2024-01-10",
        isbn: "",
        completed: false,
        episodes: [],
      },
      {
        id: "anime",
        workId: "work",
        category: "动画",
        timelineGroup: "本篇",
        title: "第一季",
        subtitle: "",
        date: "2023-10-01",
        isbn: "",
        completed: false,
        episodes: [
          {
            id: "episode",
            publicationId: "anime",
            number: "12",
            title: "最终话",
            date: "2024-03-20",
            completed: false,
          },
        ],
      },
      {
        id: "anime-overlap",
        workId: "work",
        category: "动画",
        timelineGroup: "本篇",
        title: "同步短篇",
        subtitle: "",
        date: "2024-01-01",
        isbn: "",
        completed: false,
        episodes: [],
      },
      {
        id: "anime-spinoff",
        workId: "work",
        category: "动画",
        timelineGroup: "GGO 外传",
        title: "GGO",
        subtitle: "",
        date: "2024-01-01",
        isbn: "",
        completed: false,
        episodes: [],
      },
      {
        id: "serial",
        workId: "work",
        category: "连载小说",
        title: "长篇连载",
        subtitle: "",
        date: "2001-01-01",
        endDate: "2003-06-30",
        isbn: "",
        completed: true,
        episodes: [],
      },
      {
        id: "old",
        workId: "work",
        category: "电影",
        title: "旧电影",
        subtitle: "",
        date: "1999-01-01",
        isbn: "",
        completed: true,
        episodes: [],
      },
    ],
  },
];

test("buildTimeline lays quarters out from the current year back to 2000", () => {
  const timeline = buildTimeline(works, 2024);

  assert.equal(timeline.startYear, 2024);
  assert.equal(timeline.endYear, 2000);
  assert.equal(timeline.quarterCount, 100);
  assert.equal(timeline.years[0]?.year, 2024);
  assert.equal(timeline.years[timeline.years.length - 1]?.year, 2000);

  const entries = timeline.works[0]?.tracks.flatMap(({ groups }) =>
    groups.flatMap(({ lanes }) =>
      lanes.flatMap(({ entries: laneEntries }) => laneEntries),
    ),
  );
  const novel = entries?.find(({ items }) =>
    items.some(({ target }) => target.id === "novel"),
  );
  const anime = entries?.find(({ items }) =>
    items.some(({ target }) => target.id === "anime"),
  );
  const serial = entries?.find(({ items }) =>
    items.some(({ target }) => target.id === "serial"),
  );

  assert.deepEqual(
    { startColumn: novel?.startColumn, span: novel?.span },
    { startColumn: 4, span: 1 },
  );
  assert.deepEqual(
    { startColumn: anime?.startColumn, span: anime?.span },
    { startColumn: 4, span: 2 },
  );
  assert.equal(serial?.span, 10);
  assert.equal(timeline.works[0]?.undated[0]?.target.id, "old");
});

test("buildTimeline separates semantic series and overlapping entries", () => {
  const animation = buildTimeline(works, 2024).works[0]?.tracks.find(
    ({ category }) => category === "动画",
  );
  const main = animation?.groups.find(({ name }) => name === "本篇");
  const spinoff = animation?.groups.find(({ name }) => name === "GGO 外传");

  assert.equal(main?.lanes.length, 2);
  assert.equal(spinoff?.lanes.length, 1);
  assert.deepEqual(
    main?.lanes.flatMap(({ entries }) =>
      entries.flatMap(({ items }) => items.map(({ target }) => target.id)),
    ),
    ["anime", "anime-overlap"],
  );
});

test("buildTimeline separates novel volumes, OVA entries, and anime cours", () => {
  const detailed: CatalogWork[] = [
    {
      id: "sao",
      title: "刀剑神域",
      aliases: [],
      authors: [],
      otherInfo: "",
      completed: false,
      publications: [
        {
          id: "novel-series",
          workId: "sao",
          category: "小说",
          timelineGroup: "本篇",
          title: "刀剑神域",
          subtitle: "",
          date: "2009-04-10",
          endDate: "2019-12-10",
          isbn: "",
          completed: false,
          episodes: [
            {
              id: "volume-1",
              publicationId: "novel-series",
              number: "01",
              title: "艾恩葛朗特 1",
              date: "2009-04-10",
              completed: true,
            },
            {
              id: "volume-2",
              publicationId: "novel-series",
              number: "02",
              title: "艾恩葛朗特 2",
              date: "2009-08-10",
              completed: false,
            },
            {
              id: "volume-22",
              publicationId: "novel-series",
              number: "22",
              title: "Kiss and Fly",
              date: "2019-10-10",
              completed: false,
            },
            {
              id: "volume-23",
              publicationId: "novel-series",
              number: "23",
              title: "Unital Ring Ⅱ",
              date: "2019-12-10",
              completed: false,
            },
          ],
        },
        {
          id: "third-season",
          workId: "sao",
          category: "动画",
          timelineGroup: "电视动画",
          title: "刀剑神域 Alicization",
          subtitle: "第3期",
          date: "2018-10-07",
          endDate: "2020-09-20",
          isbn: "",
          completed: false,
          episodes: Array.from({ length: 47 }, (_, index) => {
            const number = index + 1;
            const date =
              number <= 12
                ? `2018-10-${String(number).padStart(2, "0")}`
                : number <= 24
                  ? `2019-01-${String(number - 12).padStart(2, "0")}`
                  : number <= 36
                    ? `2019-10-${String(number - 24).padStart(2, "0")}`
                    : `2020-07-${String(number - 36).padStart(2, "0")}`;
            return {
              id: `a-${number}`,
              publicationId: "third-season",
              number: String(number).padStart(2, "0"),
              title: `第 ${number} 集`,
              date,
              completed: false,
            };
          }),
        },
        {
          id: "ova-series",
          workId: "sao",
          category: "OVA",
          timelineGroup: "剧场版",
          title: "刀剑神域剧场版",
          subtitle: "",
          date: "2017-02-18",
          endDate: "2021-11-12",
          isbn: "",
          completed: false,
          episodes: [
            {
              id: "movie-1",
              publicationId: "ova-series",
              number: "01",
              title: "序列争战",
              date: "2017-02-18",
              completed: false,
            },
            {
              id: "movie-2",
              publicationId: "ova-series",
              number: "02",
              title: "无星之夜的咏叹调",
              date: "2021-11-12",
              completed: false,
            },
          ],
        },
      ],
    },
  ];
  const tracks = buildTimeline(detailed, 2024).works[0]!.tracks;
  const entries = tracks.flatMap(({ groups }) =>
    groups.flatMap(({ lanes }) =>
      lanes.flatMap(({ entries: laneEntries }) => laneEntries),
    ),
  );

  const volumeEntries = entries.filter(({ items }) =>
    items.some(
      ({ target, key }) =>
        target.storeName === "episodes" && key.startsWith("volume"),
    ),
  );
  const movieEntries = entries.filter(({ items }) =>
    items.some(
      ({ target, key }) =>
        target.storeName === "episodes" && key.startsWith("movie"),
    ),
  );
  const animeEntries = entries
    .filter(({ items }) => items[0]?.target.id === "third-season")
    .sort(({ items: left }, { items: right }) =>
      left[0]!.key.localeCompare(right[0]!.key),
    );
  const novelGroup = tracks
    .find(({ category }) => category === "小说")
    ?.groups.find(({ name }) => name === "本篇");
  const sharedQuarter = volumeEntries.find(({ items }) =>
    items.some(({ key }) => key === "volume-22"),
  );

  assert.deepEqual(
    volumeEntries.map(({ span }) => span),
    [1, 1, 1],
  );
  assert.equal(novelGroup?.lanes.length, 1);
  assert.deepEqual(
    sharedQuarter?.items.map(({ key }) => key),
    ["volume-22", "volume-23"],
  );
  assert.deepEqual(
    movieEntries.map(({ span }) => span),
    [1, 1],
  );
  assert.deepEqual(
    animeEntries.map(({ items, span }) => [items[0]?.subtitle, span]),
    [
      ["第3期", 2],
      ["第3期", 1],
      ["第3期", 1],
    ],
  );
});

test("buildTimeline packs standalone publications from one quarter into one cell", () => {
  const manga: CatalogWork[] = [
    {
      id: "yuru-camp",
      title: "摇曳露营△",
      aliases: [],
      authors: ["Afro"],
      otherInfo: "",
      completed: false,
      publications: [
        {
          id: "volume-9",
          workId: "yuru-camp",
          category: "漫画",
          timelineGroup: "本篇",
          title: "摇曳露营△ 第9卷",
          subtitle: "漫画单行本",
          date: "2020-01-10",
          isbn: "978-4-8322-7149-4",
          completed: false,
          episodes: [],
        },
        {
          id: "volume-10",
          workId: "yuru-camp",
          category: "漫画",
          timelineGroup: "本篇",
          title: "摇曳露营△ 第10卷",
          subtitle: "漫画单行本",
          date: "2020-03-12",
          isbn: "978-4-8322-7174-6",
          completed: false,
          episodes: [],
        },
      ],
    },
  ];
  const group = buildTimeline(manga, 2024).works[0]!.tracks[0]!.groups[0]!;

  assert.equal(group.lanes.length, 1);
  assert.equal(group.lanes[0]!.entries.length, 1);
  assert.deepEqual(
    group.lanes[0]!.entries[0]!.items.map(({ target }) => target.id),
    ["volume-9", "volume-10"],
  );
});

test("buildTimeline only splits animation with continuous episode numbers", () => {
  const discontinuous: CatalogWork[] = [
    {
      id: "work",
      title: "作品",
      aliases: [],
      authors: [],
      otherInfo: "",
      completed: false,
      publications: [
        {
          id: "specials",
          workId: "work",
          category: "动画",
          title: "特别篇合集",
          subtitle: "特别篇",
          date: "2020-01-01",
          isbn: "",
          completed: false,
          episodes: [
            {
              id: "special-1",
              publicationId: "specials",
              number: "01",
              title: "第一集",
              date: "2020-01-01",
              completed: false,
            },
            {
              id: "special-ex",
              publicationId: "specials",
              number: "EX",
              title: "特别篇",
              date: "2022-01-01",
              completed: false,
            },
            {
              id: "special-3",
              publicationId: "specials",
              number: "03",
              title: "第三集",
              date: "2020-01-08",
              completed: false,
            },
          ],
        },
      ],
    },
  ];
  const entries = buildTimeline(
    discontinuous,
    2024,
  ).works[0]!.tracks[0]!.groups[0]!.lanes.flatMap(
    ({ entries: laneEntries }) => laneEntries,
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.items[0]?.subtitle, "特别篇");
});

test("buildTimeline uses a separated EX episode as its own marker", () => {
  const withExtra: CatalogWork[] = [
    {
      id: "work",
      title: "作品",
      aliases: [],
      authors: [],
      otherInfo: "",
      completed: false,
      publications: [
        {
          id: "season-1",
          workId: "work",
          category: "动画",
          title: "第一期",
          subtitle: "第1期",
          date: "2020-01-01",
          isbn: "",
          completed: false,
          episodes: [
            {
              id: "episode-1",
              publicationId: "season-1",
              number: "01",
              title: "第一集",
              date: "2020-01-01",
              completed: false,
            },
            {
              id: "episode-2",
              publicationId: "season-1",
              number: "02",
              title: "第二集",
              date: "2020-01-08",
              completed: false,
            },
            {
              id: "episode-ex",
              publicationId: "season-1",
              number: "EX",
              title: "总集篇",
              date: "2021-01-01",
              completed: false,
            },
          ],
        },
      ],
    },
  ];
  const entries = buildTimeline(withExtra, 2024).works[0]!.tracks[0]!.groups[0]!
    .lanes[0]!.entries;
  const items = entries.flatMap((entry) => entry.items);
  const series = items.find(({ target }) => target.id === "season-1");
  const extra = items.find(({ target }) => target.id === "episode-ex");

  assert.equal(series?.subtitle, "第1期");
  assert.equal(series?.episodeCount, 2);
  assert.equal(extra?.title, "总集篇");
  assert.equal(extra?.subtitle, "第1期 · EX");
  assert.equal(extra?.target.storeName, "episodes");
});
