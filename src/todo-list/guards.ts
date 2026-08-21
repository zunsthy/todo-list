import type { ACGNCategory, ItemType } from "../types/todo-list.js";

export const acgnCategories = [
  "animation",
  "comic",
  "novel",
  "game",
] as const satisfies readonly ACGNCategory[];

export const isACGNCategory = (value: string): value is ACGNCategory =>
  acgnCategories.some((category) => category === value);

export const isItemFormType = (value: string): value is ItemType =>
  value === "acgn" || value === "others";
