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
import { CatalogBridgeBanner } from "../bridge/Control.js";
import { useCatalogBridge } from "../bridge/context.js";
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
import { buildTimeline } from "./model/timeline.js";

const emptyCatalog = (): CatalogSnapshot => ({
  works: [],
  publications: [],
  episodes: [],
  completion: [],
});

export const Catalog = () => {
  const [snapshot, setSnapshot] = useState<CatalogSnapshot>(emptyCatalog);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [editing, setEditing] = useState<CatalogRecordTarget | null>(null);
  const invoke = useService();
  const catalogBridge = useCatalogBridge();

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

  const loadCatalog = useCallback((): void => {
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
      setLoadError(null);
      setReady(true);
    });
  }, [invoke]);

  useEffect(loadCatalog, [
    loadCatalog,
    catalogBridge.changeVersion,
    catalogBridge.enabled,
  ]);

  useEffect(() => {
    if (catalogBridge.enabled) setEditing(null);
  }, [catalogBridge.enabled]);

  const works = useMemo(() => buildCatalog(snapshot), [snapshot]);
  const currentYear = new Date().getFullYear();
  const timeline = useMemo(
    () => buildTimeline(works, currentYear),
    [works, currentYear],
  );
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
    return (
      <>
        <CatalogBridgeBanner />
        <p role="alert" title={loadError.message}>
          无法读取作品目录。
        </p>
      </>
    );
  }

  return (
    <CatalogActionsContext.Provider value={actions}>
      <CatalogBridgeBanner />
      <Editor
        editing={editing}
        onEditingChange={setEditing}
        ready={ready}
        snapshot={snapshot}
        timeline={timeline}
        works={works}
      />
      <Timeline onEdit={setEditing} timeline={timeline} />
    </CatalogActionsContext.Provider>
  );
};
