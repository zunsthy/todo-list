import React, { useContext } from "react";
import { ServiceContext } from "../service/index.js";
import { CategoryList } from "./CategoryList.jsx";

export const ItemList = ({ list, update }) => {
  const invoke = useContext(ServiceContext);

  const handleAdd = (ev) => {
    ev.preventDefault();

    const form = ev.currentTarget;
    const name = form.elements.item("name").value.trim();
    const entry = { name };
    invoke("add", { storeName: "item", dataList: [entry] }, (err) => {
      if (err) {
        console.error(err);
        return;
      }
      update(list.concat({ ...entry, list: [] }));
    });
  };

  const handleUpdate = (categoryList, index) => {
    const prev = list.slice(0, index);
    const next = list.slice(index + 1);
    const item = { ...list[index], list: categoryList };
    update(prev.concat(item, next));
  };

  return (
    <section className="list">
      <header>
        <form name="itemForm" onSubmit={handleAdd}>
          <h6>+Item</h6>
          <label>
            <span>Name</span>
            <input name="name" type="text" required />
          </label>
          <input type="submit" value="Add" />
        </form>
      </header>

      <main>
        {list.map((item, index) => (
          <div key={item.name}>
            <h2>{item.name}</h2>
            <CategoryList
              item={item.name}
              list={item.list}
              update={(list) => {
                handleUpdate(list, index);
              }}
            />
          </div>
        ))}
      </main>
    </section>
  );
};
