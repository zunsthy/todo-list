import { useState, type FormEvent } from "react";
import type {
  CatalogImportScope,
  DataTransferProps,
} from "../../../types/catalog.js";
import { useCatalogActions } from "../context.js";
import { createCatalogExport, parseCatalogImport } from "../model/transfer.js";

const downloadCatalog = (
  snapshot: DataTransferProps["snapshot"],
  includeCompletion: boolean,
): void => {
  const exported = createCatalogExport(snapshot, includeCompletion);
  const blob = new Blob([`${JSON.stringify(exported, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `todo-list-${exported.exportedAt.slice(0, 10)}${
    includeCompletion ? "" : "-without-completion"
  }.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const DataTransfer = ({ snapshot }: DataTransferProps) => {
  const { importData } = useCatalogActions();
  const [scope, setScope] = useState<CatalogImportScope>("all");
  const [parentId, setParentId] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const handleImport = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file");
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
    const file = input.files[0];

    void (async () => {
      try {
        const value: unknown = JSON.parse(await file.text());
        const data = parseCatalogImport(
          value,
          scope,
          snapshot,
          parentId || undefined,
        );
        const count = Object.values(data).reduce(
          (total, records) => total + (records?.length ?? 0),
          0,
        );
        if (
          !window.confirm(
            `将导入 ${count} 条数据。应用备份会按 UUID 合并，外部数据会生成新 UUID 后追加。继续吗？`,
          )
        ) {
          return;
        }

        setFailed(false);
        setMessage("正在导入…");
        await importData(data);
        input.value = "";
        setMessage(`已导入 ${count} 条数据。`);
      } catch (error: unknown) {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : String(error));
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
            <form onSubmit={handleImport}>
              <label>
                <span>导入范围</span>
                <select
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
                <span>JSON 文件</span>
                <input
                  accept="application/json,.json"
                  name="file"
                  required
                  type="file"
                />
              </label>
              <button type="submit">导入</button>
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
