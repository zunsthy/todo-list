import type {
  CatalogExportDocument,
  CatalogSnapshot,
} from "../../types/catalog.js";
import {
  createCatalogExport,
  createCatalogWorkExport,
} from "../model/transfer.js";
import {
  downloadJson,
  safeFileName,
} from "../../../../shared/utils/download.js";

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
  const date = includeDate ? `-${exported.exportedAt.slice(0, 10)}` : "";
  downloadJson(exported, `${safeFileName(name)}${date}${suffix}.json`);
};
