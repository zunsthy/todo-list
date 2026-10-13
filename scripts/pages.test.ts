import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { findPage, pages } from "../src/app/pages.ts";
import {
  pageOutputPaths,
  projectDirectory,
  renderPage,
} from "./build-config.ts";

test("page routes separate home, works, legacy links, and unknown paths", () => {
  for (const pathname of ["/", "/index.html"])
    assert.equal(findPage(pathname)?.id, "home");
  for (const pathname of [
    "/works",
    "/works/",
    "/works/index.html",
    "/todo-list.html",
  ])
    assert.equal(findPage(pathname)?.id, "works");
  for (const pathname of [
    "/travel/missing",
    "/works/missing",
    "/works-other",
    "/assets/todo-list.js",
  ])
    assert.equal(findPage(pathname), undefined);
  for (const pathname of ["/travel", "/travel/", "/travel/index.html"])
    assert.equal(findPage(pathname)?.id, "travel");
});

test("only works pages load works styles and expose catalog bridge control", async () => {
  const home = await renderPage(true, true, "home");
  const works = await renderPage(true, true, "works");
  const productionWorks = await renderPage(false, false, "works");
  const travel = await renderPage(true, true, "travel");
  assert.doesNotMatch(home, /todo-list-catalog-bridge|pages\/works\/styles/);
  assert.match(works, /<title>作品 · Todo-list<\/title>/);
  assert.match(works, /content="\/__catalog\/ws"/);
  assert.match(works, /href="\/assets\/pages\/works\/styles\/index.css"/);
  assert.match(works, /src="\/assets\/todo-list.js"/);
  assert.doesNotMatch(productionWorks, /todo-list-catalog-bridge|\?dev/);
  assert.match(travel, /<title>足迹 · Todo-list<\/title>/);
  assert.match(travel, /href="\/assets\/pages\/travel\/styles\/index.css"/);
  assert.doesNotMatch(travel, /todo-list-catalog-bridge|pages\/works\/styles/);
  assert.match(travel, /https:\/\/esm.sh\/d3-hexbin@0.2.2/);
  assert.doesNotMatch(travel, /d3-hexgrid/);
  assert.doesNotMatch(works, /d3-hexbin/);
  JSON.parse(
    travel.match(/<script type="importmap">([\s\S]*?)<\/script>/)![1]!,
  );
  assert.match(
    travel,
    /name="todo-list-travel-bridge" content="\/__travel\/ws"/,
  );
  assert.doesNotMatch(
    await renderPage(false, false, "travel"),
    /todo-list-travel-bridge/,
  );
});

test("static builds include a works directory entry and the legacy HTML entry", () => {
  assert.deepEqual(pageOutputPaths(pages[0]), ["index.html"]);
  assert.deepEqual(pageOutputPaths(pages[1]), [
    "works/index.html",
    "todo-list.html",
  ]);
  assert.deepEqual(pageOutputPaths(pages[2]), ["travel/index.html"]);
});

test(
  "development server serves works deep links, module CSS, HEAD, and 404",
  { timeout: 15_000 },
  async (t) => {
    const child = spawn(
      process.execPath,
      ["scripts/dev.ts", "--catalog-bridge"],
      {
        cwd: projectDirectory,
        env: { ...process.env, HOST: "127.0.0.1", PORT: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    t.after(async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    });
    const baseUrl = await new Promise<string>((resolve, reject) => {
      let output = "";
      let errors = "";
      child.stdout.on("data", (data: Buffer) => {
        output += data.toString();
        const match = output.match(/Development server: (http:\/\/[^\s]+)/);
        if (match) resolve(match[1]!);
      });
      child.stderr.on("data", (data: Buffer) => {
        errors += data.toString();
      });
      child.once("error", reject);
      child.once("exit", (code) =>
        reject(new Error(`Server exited ${code}: ${errors}`)),
      );
    });
    for (const pathname of [
      "/works",
      "/works/",
      "/works/index.html",
      "/todo-list.html",
    ]) {
      const response = await fetch(`${baseUrl}${pathname}?view=timeline`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /作品 · Todo-list/);
    }
    const home = await fetch(baseUrl);
    assert.doesNotMatch(await home.text(), /todo-list-catalog-bridge/);
    for (const pathname of ["/travel", "/travel/", "/travel/index.html"]) {
      const response = await fetch(`${baseUrl}${pathname}`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /足迹 · Todo-list/);
    }
    for (const pathname of [
      "/assets/styles/index.css",
      "/assets/styles/editor-trigger.css",
      "/assets/pages/works/styles/index.css",
      "/assets/pages/works/styles/timeline.css",
      "/assets/pages/travel/styles/index.css",
      "/assets/styles/modal.css",
    ]) {
      const response = await fetch(`${baseUrl}${pathname}`);
      assert.equal(response.status, 200, pathname);
      assert.match(response.headers.get("content-type") ?? "", /text\/css/);
    }
    const head = await fetch(`${baseUrl}/works`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal((await fetch(`${baseUrl}/works/missing`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/travel/missing`)).status, 404);
    assert.equal(
      (await fetch(`${baseUrl}/assets/pages/works/types/catalog.ts`)).status,
      404,
    );
    assert.deepEqual(await (await fetch(`${baseUrl}/__catalog/pages`)).json(), {
      pages: [],
    });
  },
);
