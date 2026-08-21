import type { FormEvent } from "react";
import type { ACGNCategoryFormProps } from "../../types/list.js";
import type { TodoItem } from "../../types/todo-list.js";
import { isACGNCategory } from "../guards.js";
import { formValue } from "../utils/form.js";
import { useUpdateList } from "./context.js";

export const ACGNCategoryForm = ({ pid }: ACGNCategoryFormProps) => {
  const update = useUpdateList();

  const handleAdd = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = formValue(formData, "name");
    const category = formValue(formData, "category");

    if (!isACGNCategory(category)) {
      throw new Error(`Unsupported ACGN category: ${category}`);
    }

    const entry: TodoItem = {
      pid,
      id: `${pid}>${name}`,
      name,
      type: "acgn_category",
      date: formValue(formData, "date"),
      category,
      series: formValue(formData, "series"),
    };
    update(entry);
  };

  return (
    <form name="acgnCategoryForm" onSubmit={handleAdd}>
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
