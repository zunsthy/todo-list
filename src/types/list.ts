import type { ReactNode } from "react";
import type { TodoItem } from "./todo-list.js";

export interface ACGNCategoryFormProps {
  pid: string;
}

export interface ACGNContentProps {
  item: TodoItem;
}

export interface ACGNDetailFormProps {
  pid: string;
}

export interface ItemFormProps {
  pid?: string;
  prefix?: string;
}

export interface ItemListProps {
  header: ReactNode;
  list?: readonly TodoItem[];
}
