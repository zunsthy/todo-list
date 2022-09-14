import React from "react";
import ReactDOM from "react-dom/client";
import { List } from "./List/index.jsx";
import { ServiceWrapper } from "./service/index.js";

export const app = (element) => {
  const root = ReactDOM.createRoot(element);
  root.render(
    <ServiceWrapper>
      <section className="page">
        <header>
          <h2>To-Do List</h2>
        </header>
        <List />
      </section>
    </ServiceWrapper>
  );
};
