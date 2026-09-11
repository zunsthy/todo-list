# Todo-list

一个使用 IndexedDB 保存个人数据的可视化应用。

- `/`：可视化模块入口。
- `/works`：作品发行与观看、阅读进度时间轴。
- `/travel`：地区树与足迹管理。

足迹已实现树形界面与服务端数据桥；地图尚未实现。

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

## 足迹

打开 `/travel`，也支持 `/travel/` 和 `/travel/index.html` 直接访问。

1. 首次只有中国。选择一个地区，点击可拖动的“数据管理”浮动按钮，在面板中使用“添加下级”
   手动录入，或用“导入下级”选择／粘贴
   JSON 清单；预览后确认，每次只导入直接下级。第一版不内置全国地区数据或自动查询服务。
2. 在本地叶节点“添加足迹”，填写名称、单个时间、一个到访方式和说明。时间支持年、月、日
   三种精度，也可留空。地图标注点可留空；填写时经度、纬度和坐标系必须一起提供。
3. 顶部汇总栏集中放置地区搜索、年份／方式筛选和“只看有足迹的地区”。主页面只展示地区树，
   足迹直接显示在所属地区下；点击足迹可打开编辑面板。不再显示独立标题区、详情栏或提示文案。
4. 已有足迹的地区以后展开下级，原足迹继续留在原地区。删除足迹不会裁剪树或清理边界。
5. “导出备份”包含全部地区、足迹和独立边界数据；“导出分支”包含所选分支及必要祖先。
   导入备份按编码／记录 ID 合并，先预览更新，不删除本地缺项。建议删除记录前先备份。

添加国家、备份操作及地区／足迹管理均收在浮动面板中；面板可切换当前地区，也可包含下级足迹。
足迹沿用作品页的简洁样式：白底、灰色细线、直角控件和紧凑间距，只有错误／删除操作保留少量红色。
“保存”或“取消”返回管理面板，关闭按钮／Escape 关闭面板。足迹与作品共用浮动按钮的位置，
统一保存在 `todo-list:editor-trigger-position`，切换页面或通过浏览器历史返回时沿用最近的位置。

足迹模块使用独立的 `todo-list-travel` IndexedDB 数据库，不改变作品的 `todo` 数据库。
地区编码为主键，边界单独存表、按 key 读取；日常树和足迹快照不加载边界坐标。
同源页面通过 BroadcastChannel 通知刷新，保存时检查旧记录，避免旧表单覆盖较新的修改。
`TravelPage.tsx` 只负责页面组装与选择／筛选状态；`hooks/useTravelData.ts` 管理数据库生命周期，
`Overview`、`RegionTree`、`DataManager` 和 `EditorPanel` 分别负责汇总、树展示、管理列表与编辑流程。

使用 `npm run dev:bridge` 启动后，可在足迹“数据管理”中开启“允许服务端操作数据”。
通过 `/__travel/pages` 发现页面，使用 `travel.*` 查询以及预览、提交写入。
协议和调用示例见 [docs/travel-bridge.md](docs/travel-bridge.md)。

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
`http://127.0.0.1:8080/works` for the works timeline, or
`http://127.0.0.1:8080/travel` for the region tree and footprints.

To let a local tool operate the catalog in the current browser page, start with
`npm run dev:bridge` and enable server control in the data manager. See
[docs/catalog-bridge.md](docs/catalog-bridge.md) for the RPC protocol.
The same command also enables the independent footprints bridge on `/travel`.

The browser, development server, and production build share the page definitions
in `src/app/pages.ts`. The server renders `src/index.mustache` for each page request. `tsc` watches the
TypeScript sources and emits browser-native ES modules, which the server exposes
with the CSS and web worker under `/assets`.

Shared styles live under `src/styles`; module-specific styles live under
`src/pages/works/styles` and `src/pages/travel/styles` and load only on their
respective pages. CSS uses native cascade layers.

Application navigation and routing live under `src/app`, while `src/pages/works`
owns the catalog UI, data types, database, worker, and catalog bridge handlers.
Reusable form helpers, JSON downloads, error serialization, and the floating
data-manager button and modal dialog live under `src/shared`. Travel owns its UI,
validation and asynchronous IndexedDB access under `src/pages/travel`; it does not
start the works worker. Bridge transport and control components live under `src/shared/bridge`,
with module-isolated forwarding in `scripts/bridge`. The home page does not initialize either database.
Leaving the works page closes its worker and
bridge connection; returning through browser history restores them and reloads
the catalog, including when the browser restores a cached page.

React's bare module imports are resolved by the import map in the rendered page.
It uses version-pinned modules from `esm.sh`, so the browser needs network access
when those modules are not already cached.

Create a production build in `dist`:

```bash
npm run build
```

The build emits `dist/index.html`, `dist/works/index.html`, `dist/travel/index.html`,
and the compatible `dist/todo-list.html` entry. Serve `dist` at the origin root with
a static server that supports directory index files; `/works/` and `/travel/` work
without an SPA fallback.
Browser assets and the catalog bridge use paths relative to the origin root.

Run the type checker, unit tests, and production build together:

```bash
npm run check
```

`HOST` and `PORT` can override the development server's defaults of `127.0.0.1`
and `8080`.

## License

Licensed by MPL-2.0.
