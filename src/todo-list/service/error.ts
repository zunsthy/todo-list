import type { SerializedError } from "../../types/service.js";

export const serializeError = (error: unknown): SerializedError => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { name: "Error", message: String(error) };
};
