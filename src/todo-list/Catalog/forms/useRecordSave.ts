import { useRef, useState } from "react";
import type { CatalogRecordMutation } from "../../../types/catalog.js";
import { useCatalogActions } from "../context.js";

export const useRecordSave = (editing: boolean, onSaved?: () => void) => {
  const { addRecord, updateRecord } = useCatalogActions();
  const pendingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = (
    form: HTMLFormElement,
    mutation: CatalogRecordMutation,
  ): void => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setSaving(true);
    setError(null);
    void (async () => {
      try {
        await (editing ? updateRecord : addRecord)(mutation);
        if (!editing) form.reset();
        onSaved?.();
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        pendingRef.current = false;
        setSaving(false);
      }
    })();
  };

  return { save, saving, error };
};
