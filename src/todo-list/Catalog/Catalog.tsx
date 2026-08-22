import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CatalogActions,
  CatalogMutation,
  CatalogRecordTarget,
  CatalogSnapshot,
  DeleteCatalogRecord,
  ImportCatalogData,
  SaveCatalogRecord,
  SetCompletion,
} from "../../types/catalog.js";
import { useService } from "../service/index.js";
import { Editor } from "./components/Editor.js";
import { Timeline } from "./components/Timeline.js";
import { CatalogActionsContext } from "./context.js";
import {
  appendCatalogRecord,
  buildCatalog,
  mergeCatalogSnapshot,
  removeCatalogRecord,
  updateCatalogRecord,
} from "./model/catalog.js";

const emptyCatalog = (): CatalogSnapshot => ({
  works: [],
  publications: [],
  episodes: [],
  completion: [],
});

export const Catalog = () => {
  const [snapshot, setSnapshot] = useState<CatalogSnapshot>(emptyCatalog);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [editing, setEditing] = useState<CatalogRecordTarget | null>(null);
  const invoke = useService();

  const addRecord = useCallback<SaveCatalogRecord>(
    (mutation) =>
      new Promise((resolve, reject) => {
        invoke("add", mutation, (error) => {
          if (error) {
            reject(error);
            return;
          }
          setSnapshot((current) => appendCatalogRecord(current, mutation));
          resolve();
        });
      }),
    [invoke],
  );

  const updateRecord = useCallback<SaveCatalogRecord>(
    (mutation) =>
      new Promise((resolve, reject) => {
        invoke("update", mutation, (error) => {
          if (error) {
            reject(error);
            return;
          }
          setSnapshot((current) => updateCatalogRecord(current, mutation));
          resolve();
        });
      }),
    [invoke],
  );

  const deleteRecord = useCallback<DeleteCatalogRecord>(
    (target) =>
      new Promise((resolve, reject) => {
        invoke("delete", target, (error) => {
          if (error) {
            reject(error);
            return;
          }
          setSnapshot((current) => removeCatalogRecord(current, target));
          resolve();
        });
      }),
    [invoke],
  );

  const importData = useCallback<ImportCatalogData>(
    (data) =>
      new Promise((resolve, reject) => {
        invoke("import", data, (error) => {
          if (error) {
            reject(error);
            return;
          }
          setSnapshot((current) => mergeCatalogSnapshot(current, data));
          resolve();
        });
      }),
    [invoke],
  );

  const setCompletion = useCallback<SetCompletion>(
    (id, completed) => {
      const mutation: CatalogMutation = {
        storeName: "completion",
        dataList: [{ id, completed }],
      };
      return new Promise((resolve, reject) => {
        invoke("update", mutation, (error) => {
          if (error) {
            reject(error);
            return;
          }
          setSnapshot((current) => updateCatalogRecord(current, mutation));
          resolve();
        });
      });
    },
    [invoke],
  );

  useEffect(() => {
    invoke("all", {}, (error, data) => {
      if (error) {
        setLoadError(error);
        return;
      }
      if (!data) {
        setLoadError(new Error("The database returned no catalog data"));
        return;
      }
      setSnapshot(data);
    });
  }, [invoke]);

  const works = useMemo(() => buildCatalog(snapshot), [snapshot]);
  const actions = useMemo<CatalogActions>(
    () => ({
      addRecord,
      updateRecord,
      deleteRecord,
      importData,
      setCompletion,
    }),
    [addRecord, deleteRecord, importData, setCompletion, updateRecord],
  );

  if (loadError) {
    return <p role="alert">无法读取作品目录。</p>;
  }

  return (
    <CatalogActionsContext.Provider value={actions}>
      <Editor
        editing={editing}
        onEditingChange={setEditing}
        snapshot={snapshot}
        works={works}
      />
      <Timeline onEdit={setEditing} works={works} />
    </CatalogActionsContext.Provider>
  );
};
