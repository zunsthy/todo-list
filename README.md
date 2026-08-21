# To Do List

This project builds a small browser-based to-do list backed by IndexedDB.

Many articles say that "to-do list" is very simple to FE beginner. I think that it's a nice try to learn js, css and html for me.

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
