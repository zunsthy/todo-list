import type {
  CatalogExportDocument,
  CatalogSnapshot,
} from "../../../types/catalog.js";
import {
  createCatalogExport,
  createCatalogWorkExport,
} from "../model/transfer.js";

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
  downloadDocument(
    createCatalogExport(snapshot, includeCompletion),
    name,
    includeCompletion ? "" : "-without-completion",
  );
};

export const downloadCatalogWork = (
  snapshot: CatalogSnapshot,
  workId: string,
  name: string,
): void => {
  downloadDocument(createCatalogWorkExport(snapshot, workId), name);
};

const downloadDocument = (
  exported: CatalogExportDocument,
  name: string,
  suffix = "",
): void => {
  const blob = new Blob([`${JSON.stringify(exported, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(name)}-${exported.exportedAt.slice(0, 10)}${suffix}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
