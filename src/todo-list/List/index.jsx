import React, { useContext, useEffect, useState } from "react";
import { ServiceContext } from "../service/index.js";

export const List = () => {
  const [list, setList] = useState([]);
  const invoke = useContext(ServiceContext);

  useEffect(() => {
    invoke("all", {}, (err, data) => {
      if (err) return;

      console.log(data);

      // if (data.list) {
      //   setList(list);
      // }
    });
    // initial list
  }, []);

  return (
    <section className="list">
      <header></header>
      <main>
        {list.map((item) => {
          <div key={item.name}>{item.name}</div>;
        })}
      </main>
    </section>
  );
};
