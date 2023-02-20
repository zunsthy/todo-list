import React, { useContext } from "react";
import { ServiceContext } from "../service/index.js";

export const SeriesList = ({ item, category, list, update }) => {
  const invoke = useContext(ServiceContext);

  const handleAdd = (ev) => {
    ev.preventDefault();

    const form = ev.currentTarget;
    const name = form.elements.item("name").value.trim();
    const entry = { item, category, name };
    invoke("add", { storeName: "series", dataList: [entry] }, (err) => {
      if (err) {
        console.error(err);
        return;
      }
      update(list.concat({ ...entry, list: [] }));
    });
  };

  // const handleUpdate = (series, index) => {
  //   const prev = list.slice(0, index);
  //   const next = list.slice(index + 1);
  //   const item = { ...list[index], list: series };
  //   update(prev.concat(item, next));
  // };

  return (
    <section className="list">
      <header>
        <form name="seriesForm" onSubmit={handleAdd}>
          <h6>+Series</h6>
          <label>
            <span>Name</span>
            <input name="name" type="text" required />
          </label>

          <input type="submit" value="Add" />
        </form>
      </header>

      <main>
        {list.map((series) => (
          <div key={series.name}>
            <h4>{series.name}</h4>
          </div>
        ))}
      </main>
    </section>
  );
};
