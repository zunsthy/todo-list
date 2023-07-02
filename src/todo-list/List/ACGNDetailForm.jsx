import React, { useContext } from "react";
import { UpdateListContext } from "./context";

export const ACGNDetailForm = ({ pid }) => {
  const update = useContext(UpdateListContext);

  const handleAdd = (ev) => {
    ev.preventDefault();

    const form = ev.currentTarget;
    const name = form.elements.namedItem("name").value.trim();
    const id = `${pid}>${name}`;
    const entry = { pid, id, name, type: "acgn_detail" };
    update(entry);
  };

  return (
    <form name="detailForm" onSubmit={handleAdd}>
      <h4>+Series</h4>
      <label>
        <span>Name</span>
        <input name="name" type="text" required />
      </label>

      <input type="submit" value="Add" />
    </form>
  );
};
