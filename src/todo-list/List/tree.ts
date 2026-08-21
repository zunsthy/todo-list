import type {
  StoredTodoItem,
  TodoItem,
  TodoTree,
} from "../../types/todo-list.js";

export const buildTree = (records: readonly StoredTodoItem[]): TodoTree => {
  const table = new Map<string, TodoItem>();

  for (const record of records) {
    table.set(record.id, { ...record });
  }

  const list: TodoItem[] = [];
  const orphans: TodoItem[] = [];

  for (const item of table.values()) {
    if (!item.pid) {
      list.push(item);
      continue;
    }

    const parent = table.get(item.pid);
    if (!parent) {
      orphans.push(item);
      continue;
    }

    parent.children ??= [];
    parent.children.push(item);
  }

  return { list, table, orphans };
};

export const insertItem = (list: TodoItem[], item: TodoItem): TodoItem[] => {
  if (!item.pid) {
    return [...list, item];
  }

  for (let index = 0; index < list.length; index += 1) {
    const current = list[index];
    if (!current) continue;

    if (current.id === item.pid) {
      const result = [...list];
      result[index] = {
        ...current,
        children: [...(current.children ?? []), item],
      };
      return result;
    }

    if (current.children) {
      const children = insertItem(current.children, item);
      if (children !== current.children) {
        const result = [...list];
        result[index] = { ...current, children };
        return result;
      }
    }
  }

  return list;
};

export const updateItem = (list: TodoItem[], item: TodoItem): TodoItem[] => {
  for (let index = 0; index < list.length; index += 1) {
    const current = list[index];
    if (!current) continue;

    if (current.id === item.id) {
      const result = [...list];
      result[index] =
        item.children === undefined && current.children !== undefined
          ? { ...item, children: current.children }
          : item;
      return result;
    }

    if (current.children) {
      const children = updateItem(current.children, item);
      if (children !== current.children) {
        const result = [...list];
        result[index] = { ...current, children };
        return result;
      }
    }
  }

  return list;
};
