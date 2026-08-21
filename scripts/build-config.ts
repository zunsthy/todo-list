import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Mustache from "mustache";

export const projectDirectory = fileURLToPath(new URL("../", import.meta.url));
export const distributionDirectory = path.join(projectDirectory, "dist");
export const developmentDirectory = path.join(projectDirectory, ".dev");
export const sourceStylePath = path.join(projectDirectory, "src/style.css");

const templatePath = path.join(projectDirectory, "src/index.mustache");

export const renderPage = async (development: boolean): Promise<string> => {
  const template = await readFile(templatePath, "utf8");
  const options = development ? "?dev&target=es2022" : "?target=es2022";

  return Mustache.render(template, {
    title: "To-Do List",
    assets: {
      stylesheet: "/assets/style.css",
      script: "/assets/todo-list.js",
    },
    imports: {
      react: `https://esm.sh/react@19.2.8${options}`,
      reactJsxRuntime: `https://esm.sh/react@19.2.8/jsx-runtime${options}`,
      reactDomClient: `https://esm.sh/react-dom@19.2.8/client${options}`,
    },
  });
};
