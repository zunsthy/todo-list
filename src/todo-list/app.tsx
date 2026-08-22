import { createRoot } from "react-dom/client";
import { Catalog } from "./Catalog/Catalog.js";
import { ServiceWrapper } from "./service/index.js";

export const app = (element: HTMLElement): void => {
  createRoot(element).render(
    <ServiceWrapper>
      <section className="page">
        <Catalog />
      </section>
    </ServiceWrapper>,
  );
};
