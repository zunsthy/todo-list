import React, { useContext } from "react";
import { UpdateListContext } from "./context";

export const ACGNCategoryForm = ({ pid }) => {
  const update = useContext(UpdateListContext);

  const handleAdd = (ev) => {
    ev.preventDefault();

    const form = ev.currentTarget;
    const entry = { pid, type: "acgn_category" };
    ["name", "date", "category", "series"].forEach((name) => {
      const value = form.elements.namedItem(name).value;
      entry[name] = value;
    });
    entry.id = `${pid}>${entry.name}`;
    update(entry);
  };

  return (
    <form name="acgnAategoryForm" onSubmit={handleAdd}>
      <h4>+Category</h4>
      <label>
        <span>Name</span>
        <input name="name" type="text" required />
      </label>

      <label>
        <span>Date</span>
        <input name="date" type="date" required />
      </label>

      <label>
        <span>Category</span>
        <select name="category" required>
          <option value="animation">动画</option>
          <option value="comic">漫画</option>
          <option value="novel">小说</option>
          <option value="game">游戏</option>
        </select>
      </label>

      <label>
        <span>Series</span>
        <input name="series" type="text" />
      </label>

      <input type="submit" value="Add" />
    </form>
  );
};
