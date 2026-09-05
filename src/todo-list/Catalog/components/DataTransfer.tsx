import { useRef, useState, type FormEvent } from "react";
import type {
  CatalogImportData,
  CatalogImportScope,
  DataTransferProps,
} from "../../../types/catalog.js";
import { useCatalogActions } from "../context.js";
import {
  combineCatalogImports,
  parseCatalogImport,
} from "../model/transfer.js";
import { downloadCatalog } from "../utils/download.js";

export const DataTransfer = ({
  snapshot,
  readOnly = false,
}: DataTransferProps) => {
  const { importData } = useCatalogActions();
  const [scope, setScope] = useState<CatalogImportScope>("all");
  const [parentId, setParentId] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const importingRef = useRef(false);
  const [importing, setImporting] = useState(false);
  const disabled = readOnly || importing;

  const handleImport = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (readOnly || importingRef.current) return;
    const form = event.currentTarget;
    const input = form.elements.namedItem("file");
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
    const files = [...input.files];
    importingRef.current = true;
    setImporting(true);
    setFailed(false);
    setMessage(`正在检查 ${files.length} 个文件…`);

    void (async () => {
      try {
        const imports: CatalogImportData[] = [];
        for (const file of files) {
          try {
            const value: unknown = JSON.parse(await file.text());
            imports.push(
              parseCatalogImport(value, scope, snapshot, parentId || undefined),
            );
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : String(error);
            throw new Error(`${file.name}：${message}`);
          }
        }
        const data = combineCatalogImports(imports, snapshot);
        const count = Object.values(data).reduce(
          (total, records) => total + (records?.length ?? 0),
          0,
        );
        if (count === 0) throw new Error("所选文件中没有可导入的数据。");
        if (
          !window.confirm(
            `将从 ${files.length} 个文件导入 ${count} 条数据。应用备份会按 UUID 合并，外部数据会生成新 UUID 后追加。继续吗？`,
          )
        ) {
          setMessage("已取消导入。");
          return;
        }

        setFailed(false);
        setMessage("正在导入…");
        await importData(data);
        input.value = "";
        setMessage(`已从 ${files.length} 个文件导入 ${count} 条数据。`);
      } catch (error: unknown) {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        importingRef.current = false;
        setImporting(false);
      }
    })();
  };

  return (
    <details className="data-transfer">
      <summary>导入 / 导出</summary>
      <div className="data-transfer-content">
        <section>
          <h3>导出</h3>
          <div className="editor-record-actions">
            <button
              type="button"
              onClick={() => downloadCatalog(snapshot, true)}
            >
              导出全部
            </button>
            <button
              type="button"
              onClick={() => downloadCatalog(snapshot, false)}
            >
              导出（不含完成信息）
            </button>
          </div>
        </section>

        <section>
          <h3>导入</h3>
          <div>
            <form onSubmit={handleImport} aria-busy={importing}>
              <label>
                <span>导入范围</span>
                <select
                  disabled={disabled}
                  name="scope"
                  value={scope}
                  onChange={(event) => {
                    setScope(event.currentTarget.value as CatalogImportScope);
                    setParentId("");
                  }}
                >
                  <option value="all">整体数据</option>
                  <option value="works">作品</option>
                  <option value="publications">出版物</option>
                  <option value="episodes">集</option>
                  <option value="completion">完成信息</option>
                </select>
              </label>
              {scope === "publications" && (
                <label>
                  <span>外部数据所属作品</span>
                  <select
                    disabled={disabled}
                    value={parentId}
                    onChange={(event) => setParentId(event.currentTarget.value)}
                  >
                    <option value="">Todo-list 备份无需选择</option>
                    {snapshot.works.map((work) => (
                      <option key={work.id} value={work.id}>
                        {work.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {scope === "episodes" && (
                <label>
                  <span>外部数据所属出版物</span>
                  <select
                    disabled={disabled}
                    value={parentId}
                    onChange={(event) => setParentId(event.currentTarget.value)}
                  >
                    <option value="">Todo-list 备份无需选择</option>
                    {snapshot.publications.map((publication) => (
                      <option key={publication.id} value={publication.id}>
                        {publication.category} · {publication.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span>JSON 文件（可多选）</span>
                <input
                  accept="application/json,.json"
                  disabled={disabled}
                  multiple
                  name="file"
                  required
                  type="file"
                />
              </label>
              <button disabled={disabled} type="submit">
                {importing ? "正在导入…" : "导入"}
              </button>
              <small>
                Todo-list 备份保留 UUID；外部数据生成 UUID
                并追加。导入不会删除现有数据。
              </small>
              {message && (
                <p data-error={failed} role={failed ? "alert" : "status"}>
                  {message}
                </p>
              )}
            </form>
          </div>
        </section>
      </div>
    </details>
  );
};
