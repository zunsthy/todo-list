export type ACGNCategory = "animation" | "comic" | "novel" | "game";
export type ItemType = "acgn" | "acgn_category" | "acgn_detail" | "others";

export interface TodoItem {
  id: string;
  name: string;
  type: ItemType;
  pid?: string;
  date?: string;
  category?: ACGNCategory;
  series?: string;
  children?: TodoItem[];
}

export type StoredTodoItem = Omit<TodoItem, "children">;
export type UpdateList = (item: TodoItem) => void;

export interface TodoTree {
  list: TodoItem[];
  table: Map<string, TodoItem>;
  orphans: TodoItem[];
}
