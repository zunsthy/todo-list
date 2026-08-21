import { createContext, useContext } from "react";
import type { InvokeService } from "../../types/service.js";

export const ServiceContext = createContext<InvokeService | null>(null);

export const useService = (): InvokeService => {
  const service = useContext(ServiceContext);

  if (!service) {
    throw new Error("useService must be used inside ServiceWrapper");
  }

  return service;
};
