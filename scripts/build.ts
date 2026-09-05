import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  distributionDirectory,
  pageOutputPaths,
  renderPage,
  sourceDirectory,
  styleDirectories,
} from "./build-config.ts";
import { pages } from "../src/app/pages.ts";

const assetsDirectory = path.join(distributionDirectory, "assets");
await mkdir(assetsDirectory, { recursive: true });
for (const directory of styleDirectories) {
  await cp(
    path.join(sourceDirectory, directory),
    path.join(assetsDirectory, directory),
    { recursive: true },
  );
}
for (const page of pages) {
  const html = await renderPage(false, false, page.id);
  for (const outputPath of pageOutputPaths(page)) {
    const filePath = path.join(distributionDirectory, outputPath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, html);
  }
}

console.log(`Built ${path.relative(process.cwd(), distributionDirectory)}`);
