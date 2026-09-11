export const pages = [
  {
    id: "home",
    path: "/",
    aliases: ["/index.html"],
    title: "Todo-list",
    stylesheet: "",
  },
  {
    id: "works",
    path: "/works",
    aliases: ["/works/", "/works/index.html", "/todo-list.html"],
    title: "作品 · Todo-list",
    stylesheet: "/assets/pages/works/styles/index.css",
  },
  {
    id: "travel",
    path: "/travel",
    aliases: ["/travel/", "/travel/index.html"],
    title: "足迹 · Todo-list",
    stylesheet: "/assets/pages/travel/styles/index.css",
  },
] as const;

export type PageId = (typeof pages)[number]["id"];
export type PageDefinition = (typeof pages)[number];

export const findPage = (pathname: string): PageDefinition | undefined =>
  pages.find(
    (page) =>
      page.path === pathname ||
      page.aliases.some((alias) => alias === pathname),
  );
