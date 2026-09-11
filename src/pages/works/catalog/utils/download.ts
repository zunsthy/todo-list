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

const downloadDocument = (
  exported: CatalogExportDocument,
  name: string,
  suffix = "",
): void => {
  const date = `-${exported.exportedAt.slice(0, 10)}`;
  downloadJson(exported, `${safeFileName(name)}${date}${suffix}.json`);
};
