import React, { useContext } from "react";
import { ServiceContext } from "../service/index.js";
import { SeriesList } from "./SeriesList.jsx";

export const CategoryList = ({ item, list, update }) => {
  const invoke = useContext(ServiceContext);

  const handleAdd = (ev) => {
    ev.preventDefault();

    const form = ev.currentTarget;
    const name = form.elements.item("name").value.trim();
    const date = form.elements.item("date").value;
    const entry = { item, name, date };
    invoke("add", { storeName: "category", dataList: [entry] }, (err) => {
      if (err) {
        console.error(err);
        return;
      }
      update(list.concat({ ...entry, list: [] }));
    });
  };

  const handleUpdate = (series, index) => {
    const prev = list.slice(0, index);
    const next = list.slice(index + 1);
    const item = { ...list[index], list: series };
    update(prev.concat(item, next));
  };

  return (
    <section className="list">
      <header>
        <form name="categoryForm" onSubmit={handleAdd}>
          <h4>+Category</h4>
          <label>
            <span>Name</span>
            <input name="name" type="text" required />
          </label>

          <label>
            <span>Date</span>
            <input name="date" type="date" required />
          </label>

          <input type="submit" value="Add" />
        </form>
      </header>

      <main>
        {list.map((category, index) => (
          <div key={category.name}>
            <h6>{category.name}</h6>
            <span>{category.date}</span>
            <SeriesList
              item={item}
              category={category.name}
              list={category.list}
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
