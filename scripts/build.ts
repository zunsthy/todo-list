import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  distributionDirectory,
  renderPage,
  sourceStylePath,
} from "./build-config.ts";

const assetsDirectory = path.join(distributionDirectory, "assets");
await mkdir(assetsDirectory, { recursive: true });
await copyFile(sourceStylePath, path.join(assetsDirectory, "style.css"));
await writeFile(
  path.join(distributionDirectory, "index.html"),
  await renderPage(false),
);

console.log(`Built ${path.relative(process.cwd(), distributionDirectory)}`);
