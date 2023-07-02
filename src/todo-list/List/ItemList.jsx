import React from "react";
import { ACGNCategoryForm } from "./ACGNCategoryForm.jsx";
import { ACGNContent } from "./ACGNContent.jsx";
import { ACGNDetailForm } from "./ACGNDetailForm.jsx";
import { ItemForm } from "./ItemForm.jsx";

export const ItemList = ({ header, list }) => {
  const renderContent = (item) => {
    if (item.type === "acgn") {
      return <h3>{item.name}</h3>;
    }
    if (item.type === "acgn_category") {
      return <ACGNContent item={item} />;
    }
    return <span data-type={item.type}>{item.name}</span>;
  };

  const renderChildren = (item) => {
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
    return (
      <ItemList list={item.children} header={<ItemForm pid={item.id} />} />
    );
  };

  return (
    <section className="list">
      <header>{header}</header>

      <main>
        {list?.map((item) => (
          <div key={item.id} data-type={item.type}>
            {renderContent(item)}
            {renderChildren(item)}
          </div>
        ))}
      </main>
    </section>
  );
};
