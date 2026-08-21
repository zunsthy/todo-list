import { app } from "./todo-list/app.js";

const rootElement = document.getElementById("app-root");

if (!rootElement) {
  throw new Error('Unable to find the "app-root" element');
}

app(rootElement);
