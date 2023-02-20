import React, { useContext, useEffect, useState } from "react";
import { ServiceContext } from "../service/index.js";
import { ItemList } from "./ItemList.jsx";

const delimiter = "|";

export const List = () => {
  const [list, setList] = useState([]);
  const invoke = useContext(ServiceContext);

  useEffect(() => {
    invoke("all", {}, (err, data) => {
      if (err) return;

      // initial list
      const list = [];

      const tableItem = new Map();
      data.item.forEach((item) => {
        const index = list.push({ ...item, list: [] });
        tableItem.set(item.name, index - 1);
      });

      const tableCategory = new Map();
      data.category.forEach((category) => {
        const item = category.item;
        if (!tableItem.has(item)) return;
        const itemIndex = tableItem.get(item);
        const index = list[itemIndex].list.push({ ...category, list: [] });
        tableCategory.set(item.name + delimiter + category.name, index - 1);
      });

      const tableSeries = new Map();
      data.series.forEach((s) => {
        const item_category = s.item + delimiter + s.category;
        if (!tableCategory.has(item_category)) return;
        const itemIndex = tableItem.get(s.item);
        const categoryIndex = tableCategory.get(item_category);
        const index = list[itemIndex].list[categoryIndex].list.push({
          ...s,
          list: [],
        });
        tableSeries.set(item_category + delimiter + s.name, index - 1);
      });

      tableItem.clear();
      tableCategory.clear();
      tableSeries.clear();

      setList(list);
    });
  }, []);

  return <ItemList list={list} update={setList} />;
};
