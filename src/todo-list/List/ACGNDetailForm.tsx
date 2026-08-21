import type { FormEvent } from "react";
import type { ACGNDetailFormProps } from "../../types/list.js";
import type { TodoItem } from "../../types/todo-list.js";
import { formValue } from "../utils/form.js";
import { useUpdateList } from "./context.js";

export const ACGNDetailForm = ({ pid }: ACGNDetailFormProps) => {
  const update = useUpdateList();

  const handleAdd = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const name = formValue(new FormData(event.currentTarget), "name");
    const entry: TodoItem = {
      pid,
      id: `${pid}>${name}`,
      name,
      type: "acgn_detail",
    };
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
