import type { ReactNode } from "react";
import type { ItemListProps } from "../../types/list.js";
import type { TodoItem } from "../../types/todo-list.js";
import { ACGNCategoryForm } from "./ACGNCategoryForm.js";
import { ACGNContent } from "./ACGNContent.js";
import { ACGNDetailForm } from "./ACGNDetailForm.js";
import { ItemForm } from "./ItemForm.js";

const renderContent = (item: TodoItem): ReactNode => {
  if (item.type === "acgn") {
    return <h3>{item.name}</h3>;
  }
  if (item.type === "acgn_category") {
    return <ACGNContent item={item} />;
  }
  return <span data-type={item.type}>{item.name}</span>;
};

const renderChildren = (item: TodoItem): ReactNode => {
  if (item.type === "acgn") {
    return (
      <ItemList
        list={item.children}
        header={<ACGNCategoryForm pid={item.id} />}
      />
    );
  }
  if (item.type === "acgn_category") {
    return (
      <ItemList
        list={item.children}
        header={<ACGNDetailForm pid={item.id} />}
      />
    );
  }
  if (item.type === "acgn_detail") {
    return null;
  }
  return <ItemList list={item.children} header={<ItemForm pid={item.id} />} />;
};

export const ItemList = ({ header, list }: ItemListProps) => (
  <section className="list">
    <header>{header}</header>

    <div className="list-content">
      {list?.map((item) => (
        <div key={item.id} data-type={item.type}>
          {renderContent(item)}
          {renderChildren(item)}
        </div>
      ))}
    </div>
  </section>
);
