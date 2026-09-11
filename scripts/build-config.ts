import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Mustache from "mustache";
import { pages, type PageDefinition, type PageId } from "../src/app/pages.ts";

export const projectDirectory = fileURLToPath(new URL("../", import.meta.url));
export const distributionDirectory = path.join(projectDirectory, "dist");
export const developmentDirectory = path.join(projectDirectory, ".dev");
export const sourceDirectory = path.join(projectDirectory, "src");
export const styleDirectories = [
  "styles",
  ...pages
    .filter(({ stylesheet }) => stylesheet)
    .map(({ stylesheet }) =>
      path.posix.dirname(stylesheet.slice("/assets/".length)),
    ),
];

export const pageOutputPaths = (page: PageDefinition): string[] => [
  ...new Set([
    path.posix.join(page.path.slice(1), "index.html"),
    ...page.aliases
      .filter((alias) => alias.endsWith(".html"))
      .map((alias) => alias.slice(1)),
  ]),
];

const templatePath = path.join(projectDirectory, "src/index.mustache");

export const renderPage = async (
  development: boolean,
  catalogBridge = false,
  pageId: PageId = "home",
): Promise<string> => {
  const page = pages.find(({ id }) => id === pageId)!;
  const template = await readFile(templatePath, "utf8");
  const options = development ? "?dev&target=es2022" : "?target=es2022";

  return Mustache.render(template, {
    title: page.title,
    catalogBridge:
      catalogBridge && page.id === "works" ? { path: "/__catalog/ws" } : false,
    travelBridge:
      catalogBridge && page.id === "travel" ? { path: "/__travel/ws" } : false,
    pageStylesheet: page.stylesheet,
    assets: {
      stylesheet: "/assets/styles/index.css",
      script: "/assets/todo-list.js",
    },
    imports: {
      react: `https://esm.sh/react@19.2.8${options}`,
      reactJsxRuntime: `https://esm.sh/react@19.2.8/jsx-runtime${options}`,
      reactDomClient: `https://esm.sh/react-dom@19.2.8/client${options}`,
    },
  });
};
