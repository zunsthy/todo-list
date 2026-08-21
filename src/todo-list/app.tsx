import { createRoot } from "react-dom/client";
import { List } from "./List/index.js";
import { ServiceWrapper } from "./service/index.js";

export const app = (element: HTMLElement): void => {
  createRoot(element).render(
    <ServiceWrapper>
      <section className="page">
        <header>
          <h2>To-Do List</h2>
        </header>
        <List />
      </section>
    </ServiceWrapper>,
  );
};
