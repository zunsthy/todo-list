import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  distributionDirectory,
  renderPage,
  sourceStylesDirectory,
} from "./build-config.ts";

const assetsDirectory = path.join(distributionDirectory, "assets");
await mkdir(assetsDirectory, { recursive: true });
await cp(sourceStylesDirectory, path.join(assetsDirectory, "styles"), {
  recursive: true,
});
await writeFile(
  path.join(distributionDirectory, "index.html"),
  await renderPage(false),
);

console.log(`Built ${path.relative(process.cwd(), distributionDirectory)}`);
