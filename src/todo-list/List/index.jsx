import React, { useContext, useEffect, useRef, useState } from "react";
import { ServiceContext } from "../service/index.js";
import { omit } from "../utils/object.js";
import { ItemList } from "./ItemList.jsx";
import { ItemForm } from "./ItemForm.jsx";
import { UpdateListContext } from "./context.js";

const findItemPath = (table, id, path = []) => {
  if (table.has(id)) {
    return findItemPath(table, table.get(id).pid, path.concat(id));
  }
  return path;
};

const updateItem = (table, list, item) => {
  const newList = [...list];
  let currentList = newList;
  let currentItem;
  const path = findItemPath(table, item.id);
  for (let i = 0; i < path.length; i++) {
    const index = currentList.findIndex((item) => item.id === path[i]);
    if (path[id] === item.id) {
      currentItem = item;
      if (!item.children) item.children = currentList[index].children;
    } else {
      currentItem = { ...currentList[index] };
    }
    newList[index] = currentItem;
    table.set(path[i], currentItem);
    currentList = currentItem.children;
  }
  return newList;
};

const insertItem = (table, list, item) => {
  const newList = [...list];
  let currentList = newList;
  let currentItem = { children: newList };
  const path = findItemPath(table, item.pid);
  for (let i = 0; i < path.length; i++) {
    const index = currentList.findIndex((item) => item.id === path[i]);
    currentItem = { ...currentList[index] };
    newList[index] = currentItem;
    table.set(path[i], currentItem);
    currentList = currentItem.children;
  }
  if (!currentItem.children) currentItem.children = [];
  currentItem.children.push(item);
  return newList;
};

export const List = () => {
  const [list, setList] = useState([]);
  const tableRef = useRef(new Map());
  const invoke = useContext(ServiceContext);

  const updateOrInsert = (item) => {
    const table = tableRef.current;
    if (table.has(item.id)) {
      table.set(item.id, item);
      const updateData = omit(item, ["children"]);
      // TODO: idb service "update" method
      invoke(
        "update",
        { storeName: "items", dataList: [updateData] },
        (err) => {
          if (err) {
            console.error(err);
            return;
          }
          setList(updateItem(table, list, item));
        }
      );
    } else {
      const insertData = omit(item, ["children"]);
      invoke("add", { storeName: "items", dataList: [insertData] }, (err) => {
        if (err) {
          console.error(err);
          return;
        }
        setList(insertItem(table, list, item));
      });
    }
  };

  useEffect(() => {
    invoke("all", {}, (err, data) => {
      if (err) return;

      // initial list
      const tree = [];
      const table = tableRef.current;

      data.items.forEach((item) => {
        table.set(item.id, item);
      });

      table.forEach((item) => {
        if (!item.pid) {
          tree.push(item);
        } else {
          const parentItem = table.get(item.pid);
          if (!parentItem) {
            console.warn(`Item ${item.id} isn't indexed:`, item);
            return;
          }
          if (!parentItem.children) parentItem.children = [];
          parentItem.children.push(item);
        }
      });

      setList(tree);
    });
  }, []);

  return (
    <UpdateListContext.Provider value={updateOrInsert}>
      <ItemList list={list} header={<ItemForm />} />
    </UpdateListContext.Provider>
  );
};
