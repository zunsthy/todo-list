import assert from "node:assert/strict";
import test from "node:test";
import type { LegacyTodoItem } from "../../types/database.js";
import { migrateLegacyItems } from "./migrate.ts";

const legacyItems: LegacyTodoItem[] = [
  { id: "sao", name: "刀剑神域", type: "acgn" },
  {
    id: "sao>volume-26",
    pid: "sao",
    name: "第26卷",
    type: "acgn_category",
    category: "novel",
    series: "Unital Ring V",
    date: "2021-10-08",
  },
  {
    id: "sao>anime-1",
    pid: "sao",
    name: "第1部",
    type: "acgn_category",
    category: "animation",
    date: "2012-07-08",
  },
  {
    id: "sao>anime-1>episode-1",
    pid: "sao>anime-1",
    name: "01 剑的世界",
    type: "acgn_detail",
    date: "2012-07-08",
  },
];

test("migrateLegacyItems maps the old tree to the three catalog stores", () => {
  let sequence = 0;
  const result = migrateLegacyItems(
    legacyItems,
    () => `uuid-${(sequence += 1)}`,
  );

  assert.equal(result.works[0]?.id, "uuid-1");
  assert.equal(result.works[0]?.title, "刀剑神域");
  assert.deepEqual(
    result.publications.map(({ category, title, subtitle }) => ({
      category,
      title,
      subtitle,
    })),
    [
      { category: "小说", title: "第26卷", subtitle: "Unital Ring V" },
      { category: "动画", title: "第1部", subtitle: "" },
    ],
  );
  assert.deepEqual(result.episodes[0], {
    id: "uuid-4",
    publicationId: "uuid-3",
    number: "01",
    title: "剑的世界",
    date: "2012-07-08",
  });
  assert.deepEqual(result.completion, [
    { id: "uuid-1", completed: false },
    { id: "uuid-2", completed: false },
    { id: "uuid-3", completed: false },
    { id: "uuid-4", completed: false },
  ]);
});
