# Todo-list

一个使用 IndexedDB 保存数据，标记作品观看与阅读进度的时间轴。

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

The server renders `src/index.mustache` for each page request. `tsc` watches the
TypeScript sources and emits browser-native ES modules, which the server exposes
with the CSS and web worker under `/assets`.

Styles are split by responsibility under `src/styles`; `index.css` is the only
HTML entry and orders the files with native cascade layers.

React's bare module imports are resolved by the import map in the rendered page.
It uses version-pinned modules from `esm.sh`, so the browser needs network access
when those modules are not already cached.

Create a production build in `dist`:

```bash
npm run build
```

Run the type checker, unit tests, and production build together:

```bash
npm run check
```

`HOST` and `PORT` can override the development server's defaults of `127.0.0.1`
and `8080`.

## License

Licensed by MPL-2.0.
