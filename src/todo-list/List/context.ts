import { createContext, useContext } from "react";
import type { UpdateList } from "../../types/todo-list.js";

export const UpdateListContext = createContext<UpdateList | null>(null);

export const useUpdateList = (): UpdateList => {
  const updateList = useContext(UpdateListContext);

  if (!updateList) {
    throw new Error("useUpdateList must be used inside UpdateListContext");
  }

  return updateList;
};
