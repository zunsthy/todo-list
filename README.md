# Todo-list

一个使用 IndexedDB 保存个人数据的可视化应用。

- `/`：可视化模块入口。
- `/works`：作品发行与观看、阅读进度时间轴。

旅行足迹的数据结构、按需地区树和后续实现步骤见
[docs/travel-footprints.md](docs/travel-footprints.md)，目前仅完成设计。

作品页面仍使用同一来源下原有的 `todo` 数据库；迁移到 `/works` 无需重新导入数据。
`/works/`、`/works/index.html` 和旧地址 `/todo-list.html` 也可以打开作品页面。

## Data model

- 作品：作品名、封面、别名、作者、其他信息。
- 出版物：类别、书名/剧名、子名称、开始与结束时间、ISBN。
- 集：集数、名称、时间。

一部作品可以包含多个出版物，一个出版物可以包含多集。旧版 `items` 数据会在
IndexedDB 升级时迁移到对应层级并生成 UUID。第四个 `completion` ObjectStore
保存每个 UUID 是否完成。

主界面按年份和季度倒序排列：最左侧是今年，向右回溯至 2000 年。单次发行占一格，
动画会根据集的时间自动延长，填写结束日期的连载内容会跨越完整起止区间。
同一类别还可以通过“系列轨道”拆分本篇、外传等并行内容；同系列时间重叠时会自动增加子行。
“数据管理”浮动按钮可以拖拽并记忆位置，通过原生 dialog 打开增删改及导入导出界面。
页面本身负责时间轴滚动；作品封面、出版物色块和集条目可以双击切换完成状态，
右键则会打开并定位到对应的编辑表单。
导入导出的 JSON 格式见 [docs/import-export.md](docs/import-export.md)。

## Usage

Use Node.js 22.18 or newer and install the dependencies:

```bash
npm i
```

Start the development server:

```bash
npm run dev
```

Open `http://127.0.0.1:8080/` for the module list or
`http://127.0.0.1:8080/works` for the works timeline.

To let a local tool operate the catalog in the current browser page, start with
`npm run dev:bridge` and enable server control in the data manager. See
[docs/catalog-bridge.md](docs/catalog-bridge.md) for the RPC protocol.

The browser, development server, and production build share the page definitions
in `src/app/pages.ts`. The server renders `src/index.mustache` for each page request. `tsc` watches the
TypeScript sources and emits browser-native ES modules, which the server exposes
with the CSS and web worker under `/assets`.

Shared styles live under `src/styles`; works-specific styles live under
`src/pages/works/styles` and are loaded only on the works page. Both CSS entries
order their files with native cascade layers.

Application navigation and routing live under `src/app`, while `src/pages/works`
owns the catalog UI, data types, database, worker, and catalog bridge handlers.
Reusable form helpers, JSON downloads, error serialization, and the floating
data-manager button live under `src/shared`. The home page does not initialize
the catalog worker or database. Leaving the works page closes its worker and
bridge connection; returning through browser history restores them and reloads
the catalog, including when the browser restores a cached page.

React's bare module imports are resolved by the import map in the rendered page.
It uses version-pinned modules from `esm.sh`, so the browser needs network access
when those modules are not already cached.

Create a production build in `dist`:

```bash
npm run build
```

The build emits `dist/index.html`, `dist/works/index.html`, and the compatible
`dist/todo-list.html` entry. Serve `dist` at the origin root with a static server
that supports directory index files; `/works/` works without an SPA fallback.
Browser assets and the catalog bridge use paths relative to the origin root.

Run the type checker, unit tests, and production build together:

```bash
npm run check
```

`HOST` and `PORT` can override the development server's defaults of `127.0.0.1`
and `8080`.

## License

Licensed by MPL-2.0.
