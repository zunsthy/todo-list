import { realpath, stat } from "node:fs/promises";
import path from "node:path";

export const resolveStaticFile = async (
  directory: string,
  encodedPath: string,
): Promise<string | null> => {
  try {
    const [root, file] = await Promise.all([
      realpath(directory),
      realpath(path.resolve(directory, decodeURIComponent(encodedPath))),
    ]);
    const isInside = file.startsWith(`${root}${path.sep}`);
    return isInside && (await stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
};
