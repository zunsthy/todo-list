import { Catalog } from "./catalog/Catalog.js";
import { ServiceWrapper } from "./service/index.js";

const WorksPage = () => (
  <main className="page works-page">
    <ServiceWrapper>
      <Catalog />
    </ServiceWrapper>
  </main>
);

export default WorksPage;
