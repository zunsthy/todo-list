import { createContext, useContext } from "react";
import type { CatalogBridgeStatus } from "../../types/catalog-bridge.js";

export interface CatalogBridgeContextValue {
  available: boolean;
  enabled: boolean;
  status: CatalogBridgeStatus;
  pageId: string | null;
  error: string | null;
  changeVersion: number;
  enable(pageId: string): void;
  disable(): void;
}

export const CatalogBridgeContext =
  createContext<CatalogBridgeContextValue | null>(null);

export const useCatalogBridge = (): CatalogBridgeContextValue => {
  const value = useContext(CatalogBridgeContext);
  if (!value) {
    throw new Error("useCatalogBridge must be used inside ServiceWrapper");
  }
  return value;
};
