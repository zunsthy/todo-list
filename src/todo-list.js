import { app } from "./todo-list/app.jsx";
import "./style.css";

setTimeout(() => {
  const root = document.getElementById("app-root");
  app(root);
});
