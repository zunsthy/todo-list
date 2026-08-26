import type { CatalogSnapshot } from "../../../types/catalog.js";
import { createCatalogExport } from "../model/transfer.js";

const safeFileName = (value: string): string =>
  value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .slice(0, 80) || "todo-list";

export const downloadCatalog = (
  snapshot: CatalogSnapshot,
  includeCompletion: boolean,
  name = "todo-list",
): void => {
  const exported = createCatalogExport(snapshot, includeCompletion);
  const blob = new Blob([`${JSON.stringify(exported, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(name)}-${exported.exportedAt.slice(0, 10)}${
    includeCompletion ? "" : "-without-completion"
  }.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
