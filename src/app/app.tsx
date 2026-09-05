import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { HomePage } from "../pages/home/HomePage.js";
import { findPage } from "./pages.js";

const WorksPage = lazy(() => import("../pages/works/WorksPage.js"));

export const app = (element: HTMLElement): void => {
  const page = findPage(window.location.pathname);
  createRoot(element).render(
    <>
      <nav className="app-navigation" aria-label="主导航">
        <a href="/" aria-current={page?.id === "home" ? "page" : undefined}>
          Todo-list
        </a>
        <a
          href="/works"
          aria-current={page?.id === "works" ? "page" : undefined}
        >
          作品
        </a>
      </nav>
      <Suspense
        fallback={
          <p className="empty-state" role="status">
            正在加载…
          </p>
        }
      >
        {page?.id === "works" ? (
          <WorksPage />
        ) : page?.id === "home" ? (
          <HomePage />
        ) : (
          <main className="home-page">
            <h1>页面不存在</h1>
            <a href="/">返回首页</a>
          </main>
        )}
      </Suspense>
    </>,
  );
};
