import React, { useContext } from "react";
import { UpdateListContext } from "./context";

export const ItemForm = ({ pid, prefix = pid || "" }) => {
  const update = useContext(UpdateListContext);

  const handleAdd = (ev) => {
    ev.preventDefault();

    const form = ev.currentTarget;
    const name = form.elements.namedItem("name").value.trim();
    const type = form.elements.namedItem("type").value;
    let id = form.elements.namedItem("id").value.trim() || `${prefix}>${name}`;
    const entry = { id, name, type };
    if (pid) entry.pid = pid;
    update(entry);
  };

  return (
    <form name="itemForm" onSubmit={handleAdd}>
      <h4>+Item</h4>
      <label>
        <span>Name</span>
        <input name="id" type="text" placeholder="id" />
        <input name="name" type="text" placeholder="name" required />
        <select name="type" type="type" required>
          <option defaultValue value="acgn">
            ACGN
          </option>
          <option value="others">Others</option>
        </select>
      </label>
      <input type="submit" value="Add" />
    </form>
  );
};
