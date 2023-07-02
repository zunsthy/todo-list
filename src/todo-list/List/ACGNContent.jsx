import React from "react";

export const ACGNContent = ({ item }) => {
  return (
    <>
      <h3>{item.name}</h3>
      <span>{item.date}</span>
      <span>{item.category}</span>
      <span>{item.series}</span>
    </>
  );
};
