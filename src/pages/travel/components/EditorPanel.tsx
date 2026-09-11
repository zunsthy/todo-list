import { useState } from "react";
import { EditorTrigger } from "../../../shared/components/EditorTrigger.js";
import { Modal } from "../../../shared/components/Modal.js";
import { downloadJson, safeFileName } from "../../../shared/utils/download.js";
import type { TravelDataState } from "../hooks/useTravelData.ts";
import { DataManager } from "./DataManager.js";
import type { TravelEditor } from "./DataManager.js";
import { FootprintForm, RegionForm } from "./Forms.js";
import { ImportPanel } from "./ImportPanel.js";

const editorTitle = (editor: TravelEditor): string => {
  switch (editor.kind) {
    case "region":
      return editor.region
        ? "编辑地区"
        : editor.parentId === null
          ? "添加国家"
          : "添加下级地区";
    case "footprint":
      return editor.footprint ? "编辑足迹" : "添加足迹";
    case "import":
      return editor.parentId === null ? "导入足迹备份" : "导入下级地区";
    case "delete-region":
      return "删除地区";
    case "delete-footprint":
      return "删除足迹";
  }
};

export const EditorPanel = ({
  data,
  selectedId,
  editor,
  onSelect,
  onEditorChange,
}: {
  data: TravelDataState;
  selectedId: string | null;
  editor: TravelEditor | null;
  onSelect: (id: string) => void;
  onEditorChange: (editor: TravelEditor | null) => void;
}) => {
  const [managerOpen, setManagerOpen] = useState(false);
  const { database, snapshot, busy, ready, error, message, run } = data;
  const opened = managerOpen || editor !== null;
  const returnToManager = () => {
    setManagerOpen(true);
    onEditorChange(null);
  };
  const close = () => {
    setManagerOpen(false);
    onEditorChange(null);
    data.clearFeedback();
  };
  const edit = (next: TravelEditor) => {
    data.clearFeedback();
    onEditorChange(next);
  };
  const exportBackup = (regionId?: string) => {
    void run(async (handle) => {
      const result = await handle.export(regionId);
      const name = regionId
        ? (snapshot.regions.find((region) => region.id === regionId)?.name ??
          regionId)
        : "全部足迹";
      downloadJson(
        result,
        `travel-${safeFileName(name)}-${new Date().toISOString().slice(0, 10)}.json`,
      );
    }, "备份已导出").catch(data.reportError);
  };
  return (
    <>
      <EditorTrigger
        onOpen={() => {
          data.clearFeedback();
          returnToManager();
        }}
      />
      {opened && (
        <Modal
          title={editor ? editorTitle(editor) : "数据管理"}
          busy={busy}
          onClose={close}
        >
          {!ready || !database ? (
            <p className="empty-state" role="status">
              {error || "正在读取足迹数据…"}
            </p>
          ) : (
            <>
              {message && (
                <p className="travel-notice" role="status">
                  {message}
                </p>
              )}
              <div hidden={editor !== null}>
                {error && (
                  <p className="travel-error" role="alert">
                    {error}
                  </p>
                )}
                <DataManager
                  snapshot={snapshot}
                  selectedId={selectedId}
                  busy={busy}
                  onSelect={onSelect}
                  onEdit={edit}
                  onExport={exportBackup}
                />
              </div>
              {editor && (
                <div className="travel-editor-navigation">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={returnToManager}
                  >
                    ← 返回数据管理
                  </button>
                </div>
              )}
              {editor?.kind === "region" && (
                <RegionForm
                  region={editor.region}
                  parentId={editor.parentId}
                  busy={busy}
                  onCancel={returnToManager}
                  onSave={async (region) => {
                    await run(
                      (handle) => handle.saveRegion(region, editor.region),
                      "地区已保存",
                    );
                    if (region.parentId) onSelect(region.parentId);
                    onSelect(region.id);
                    returnToManager();
                  }}
                />
              )}
              {editor?.kind === "footprint" && (
                <FootprintForm
                  footprint={editor.footprint}
                  initialRegionId={editor.regionId}
                  snapshot={snapshot}
                  busy={busy}
                  onCancel={returnToManager}
                  onSave={async (footprint) => {
                    await run(
                      (handle) =>
                        handle.saveFootprint(footprint, editor.footprint),
                      "足迹已保存",
                    );
                    onSelect(footprint.regionId);
                    returnToManager();
                  }}
                />
              )}
              {editor?.kind === "import" && (
                <ImportPanel
                  database={database}
                  parentId={editor.parentId}
                  busy={busy}
                  onCancel={returnToManager}
                  onImport={async (preview) => {
                    await run(
                      (handle) => handle.import(preview),
                      "导入完成，已有地区与足迹均已保留",
                    );
                    if (editor.parentId) onSelect(editor.parentId);
                    returnToManager();
                  }}
                />
              )}
              {(editor?.kind === "delete-region" ||
                editor?.kind === "delete-footprint") && (
                <div className="travel-delete">
                  <p>
                    确认删除“
                    {editor.kind === "delete-region"
                      ? editor.region.name
                      : editor.footprint.name}
                    ”？
                  </p>
                  <p>
                    {editor.kind === "delete-footprint"
                      ? "只删除这条足迹，地区树、导入状态和边界数据保持不变。"
                      : "只删除这个未被引用的地区，不自动清理其他地区或边界。"}{" "}
                    此操作不可撤销，建议先导出备份。
                  </p>
                  {error && (
                    <p className="travel-error" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="travel-actions">
                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
                      onClick={() => {
                        void run(
                          (handle) =>
                            editor.kind === "delete-region"
                              ? handle.deleteRegion(editor.region)
                              : handle.deleteFootprint(editor.footprint),
                          "记录已删除",
                        )
                          .then(returnToManager)
                          .catch(data.reportError);
                      }}
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={returnToManager}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
};
