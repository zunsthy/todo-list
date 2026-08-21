import { useCallback, useEffect, useRef, useState } from "react";
import type { TodoItem, UpdateList } from "../../types/todo-list.js";
import { useService } from "../service/index.js";
import { omit } from "../utils/object.js";
import { ItemForm } from "./ItemForm.js";
import { ItemList } from "./ItemList.js";
import { UpdateListContext } from "./context.js";
import { buildTree, insertItem, updateItem } from "./tree.js";

export const List = () => {
  const [list, setList] = useState<TodoItem[]>([]);
  const tableRef = useRef(new Map<string, TodoItem>());
  const invoke = useService();

  const updateOrInsert = useCallback<UpdateList>(
    (item) => {
      const table = tableRef.current;
      const exists = table.has(item.id);
      const storedItem = omit(item, ["children"]);

      if (item.pid && !table.has(item.pid)) {
        console.error(
          `Cannot add ${item.id}: parent ${item.pid} does not exist`,
        );
        return;
      }

      invoke(
        exists ? "update" : "add",
        { storeName: "items", dataList: [storedItem] },
        (error) => {
          if (error) {
            console.error(error);
            return;
          }

          table.set(item.id, item);
          setList((currentList) =>
            exists
              ? updateItem(currentList, item)
              : insertItem(currentList, item),
          );
        },
      );
    },
    [invoke],
  );

  useEffect(() => {
    invoke("all", {}, (error, data) => {
      if (error) {
        console.error(error);
        return;
      }
      if (!data) {
        console.error("The database returned no data");
        return;
      }

      const tree = buildTree(data.items);
      tableRef.current = tree.table;

      for (const item of tree.orphans) {
        console.warn(`Item ${item.id} is missing parent ${item.pid}`);
      }

      setList(tree.list);
    });
  }, [invoke]);

  return (
    <UpdateListContext.Provider value={updateOrInsert}>
      <ItemList list={list} header={<ItemForm />} />
    </UpdateListContext.Provider>
  );
};
