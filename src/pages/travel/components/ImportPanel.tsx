import { useState } from "react";
import { downloadJson } from "../../../shared/utils/download.js";
import type { TravelDatabase } from "../db.ts";
import type { ImportPreview } from "../types.ts";

export const ImportPanel = ({
  database,
  parentId,
  busy,
  onImport,
  onCancel,
}: {
  database: TravelDatabase;
  parentId: string | null;
  busy: boolean;
  onImport: (preview: ImportPreview) => Promise<void>;
  onCancel: () => void;
}) => {
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const disabled = busy || reading;
  const inspect = async () => {
    setReading(true);
    setError("");
    setPreview(null);
    try {
      setPreview(await database.previewImport(JSON.parse(source), parentId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法解析导入数据");
    } finally {
      setReading(false);
    }
  };
  const apply = async () => {
    if (!preview) return;
    setError("");
    try {
      await onImport(preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导入失败");
      setPreview(null);
    }
  };
  return (
    <section className="travel-import">
      <p>
        {parentId === null
          ? "合并足迹备份，预览新增与更新后确认。不会删除本地缺项。"
          : `只导入 ${parentId} 的直接下级，不加载其后代，也不删除已有地区。`}
      </p>
      <label>
        选择 JSON 文件
        <input
          type="file"
          accept=".json,application/json"
          disabled={disabled}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setReading(true);
            setSource("");
            setError("");
            setPreview(null);
            try {
              if (file.size > 20 * 1024 * 1024)
                throw new Error(
                  "文件不能超过 20 MB，请拆分地区清单或边界后再导入",
                );
              setSource(await file.text());
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "文件读取失败");
            } finally {
              setReading(false);
            }
          }}
        />
      </label>
      <label>
        或粘贴 JSON
        <textarea
          name="importJson"
          rows={10}
          spellCheck={false}
          value={source}
          disabled={disabled}
          onChange={(event) => {
            setSource(event.target.value);
            setPreview(null);
            setError("");
          }}
        />
      </label>
      {parentId !== null && (
        <details className="travel-import-help">
          <summary>下级清单格式与空白模板</summary>
          <p>
            每个下级至少提供 id、name、kind、pos。没有坐标时 pos 为
            null；已有坐标时必须带坐标系。
          </p>
          <pre>
            {JSON.stringify(
              {
                format: "todo-list-region-children",
                version: 1,
                parentId,
                coverage: "partial",
                children: [
                  {
                    id: "填写地区编码",
                    name: "填写地区名称",
                    kind: "区",
                    pos: null,
                  },
                ],
              },
              null,
              2,
            )}
          </pre>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              downloadJson(
                {
                  format: "todo-list-region-children",
                  version: 1,
                  parentId,
                  coverage: "partial",
                  children: [],
                },
                `travel-children-${parentId}.json`,
              )
            }
          >
            下载空白模板
          </button>
        </details>
      )}
      {error && (
        <p className="travel-error" role="alert">
          {error}
        </p>
      )}
      <div className="travel-actions">
        <button
          type="button"
          disabled={disabled || !source.trim()}
          onClick={() => void inspect()}
        >
          {reading ? "正在读取…" : "预览导入"}
        </button>
        <button
          type="button"
          className="primary"
          disabled={disabled || !preview || !preview.plan.changes.length}
          onClick={() => void apply()}
        >
          {busy ? "正在导入…" : "确认导入"}
        </button>
        <button type="button" disabled={disabled} onClick={onCancel}>
          取消
        </button>
      </div>
      {preview && (
        <div className="travel-import-preview" role="status">
          <h3>导入预览</h3>
          <p>
            新增{" "}
            {preview.plan.changes.filter((change) => !change.before).length}{" "}
            项，更新{" "}
            {preview.plan.changes.filter((change) => change.before).length}{" "}
            项，不删除任何已有记录。
          </p>
          {preview.plan.warnings.map((warning) => (
            <p className="travel-warning" key={warning}>
              {warning}
            </p>
          ))}
          {preview.plan.changes.map((change) => (
            <details key={`${change.store}:${change.id}`}>
              <summary>
                {change.before ? "更新" : "新增"} ·{" "}
                {
                  {
                    regions: "地区",
                    footprints: "足迹",
                    regionBoundaries: "边界",
                  }[change.store]
                }{" "}
                · {change.name}（{change.id}）
              </summary>
              {change.store === "regionBoundaries" ? (
                <p>边界坐标独立入库，不加入日常快照。</p>
              ) : (
                <>
                  {change.before && (
                    <>
                      <h4>原内容</h4>
                      <pre>{JSON.stringify(change.before, null, 2)}</pre>
                    </>
                  )}
                  <h4>导入后</h4>
                  <pre>{JSON.stringify(change.after, null, 2)}</pre>
                </>
              )}
            </details>
          ))}
        </div>
      )}
    </section>
  );
};
