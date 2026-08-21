import type { ACGNContentProps } from "../../types/list.js";

export const ACGNContent = ({ item }: ACGNContentProps) => (
  <>
    <h3>{item.name}</h3>
    <span>{item.date}</span>
    <span>{item.category}</span>
    <span>{item.series}</span>
  </>
);
