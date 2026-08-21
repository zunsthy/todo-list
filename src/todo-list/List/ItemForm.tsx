import type { FormEvent } from "react";
import type { ItemFormProps } from "../../types/list.js";
import type { TodoItem } from "../../types/todo-list.js";
import { isItemFormType } from "../guards.js";
import { formValue } from "../utils/form.js";
import { useUpdateList } from "./context.js";

export const ItemForm = ({ pid, prefix = pid ?? "" }: ItemFormProps) => {
  const update = useUpdateList();

  const handleAdd = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = formValue(formData, "name");
    const type = formValue(formData, "type");

    if (!isItemFormType(type)) {
      throw new Error(`Unsupported item type: ${type}`);
    }

    const entry: TodoItem = {
      id: formValue(formData, "id") || `${prefix}>${name}`,
      name,
      type,
      ...(pid ? { pid } : {}),
    };
    update(entry);
  };

  return (
    <form name="itemForm" onSubmit={handleAdd}>
      <h4>+Item</h4>
      <label>
        <span>Name</span>
        <input name="id" type="text" placeholder="id" />
        <input name="name" type="text" placeholder="name" required />
        <select name="type" defaultValue="acgn" required>
          <option value="acgn">ACGN</option>
          <option value="others">Others</option>
        </select>
      </label>
      <input type="submit" value="Add" />
    </form>
  );
};
