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

export const downloadCatalogBeforeServerControl = (
  snapshot: CatalogSnapshot,
): void => {
  const exported = createCatalogExport(snapshot, true);
  downloadDocument(
    exported,
    `todo-list-before-server-control-${exported.exportedAt}`,
    "",
    false,
  );
};

const downloadDocument = (
  exported: CatalogExportDocument,
  name: string,
  suffix = "",
  includeDate = true,
): void => {
  const blob = new Blob([`${JSON.stringify(exported, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const date = includeDate ? `-${exported.exportedAt.slice(0, 10)}` : "";
  anchor.download = `${safeFileName(name)}${date}${suffix}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
