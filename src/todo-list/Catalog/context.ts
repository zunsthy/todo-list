import { createContext, useContext } from "react";
import type { CatalogActions } from "../../types/catalog.js";

export const CatalogActionsContext = createContext<CatalogActions | null>(null);

export const useCatalogActions = (): CatalogActions => {
  const actions = useContext(CatalogActionsContext);
  if (!actions) {
    throw new Error(
      "useCatalogActions must be used inside CatalogActionsContext",
    );
  }
  return actions;
};
