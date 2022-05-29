import React from "react";
import ReactDOM from "react-dom/client";

export const app = (element) => {
  const root = ReactDOM.createRoot(element);
  root.render(<h1>To-Do List</h1>);
};
