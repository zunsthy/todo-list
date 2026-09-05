import { useEffect, useMemo, useRef, type MouseEvent } from "react";
import type {
  CatalogEditorProps,
  CatalogEntityStoreName,
  CatalogRecordTarget,
} from "../../../types/catalog.js";
import { useCatalogActions } from "../context.js";
import { EpisodeForm } from "../forms/EpisodeForm.js";
import { PublicationForm } from "../forms/PublicationForm.js";
import { WorkForm } from "../forms/WorkForm.js";
import { downloadCatalogWork } from "../utils/download.js";
import { DataTransfer } from "./DataTransfer.js";
import { EditorTrigger } from "./EditorTrigger.js";
import { CatalogBridgeControl } from "../../bridge/Control.js";
import { useCatalogBridge } from "../../bridge/context.js";

export const Editor = ({
  works,
  timeline,
  snapshot,
  ready,
  editing,
  onEditingChange,
}: CatalogEditorProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { deleteRecord, setCompletion } = useCatalogActions();
  const catalogBridge = useCatalogBridge();
  const readOnly = catalogBridge.enabled;
  const undatedIds = useMemo(
    () =>
      new Set(
        timeline.works.flatMap(({ undated }) =>
          undated.map(({ target }) => target.id),
        ),
      ),
    [timeline],
  );

  const isEditing = (storeName: CatalogEntityStoreName, id: string): boolean =>
    editing?.storeName === storeName && editing.id === id;

  const handleDelete = (target: CatalogRecordTarget, label: string): void => {
    if (readOnly) return;
    if (!window.confirm(`确认删除${label}？关联的下级数据也会被删除。`)) {
      return;
    }
    void deleteRecord(target)
      .then(() => onEditingChange(null))
      .catch(console.error);
  };

  const toggleCompletion = (
    event: MouseEvent<HTMLElement>,
    id: string,
    completed: boolean,
  ): void => {
    event.preventDefault();
    if (readOnly) return;
    void setCompletion(id, !completed).catch(console.error);
  };

  useEffect(() => {
    if (!editing) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    const frame = window.requestAnimationFrame(() => {
      const record = [
        ...dialog.querySelectorAll<HTMLElement>("[data-record-id]"),
      ].find((element) => element.dataset.recordId === editing.id);
      if (!record) return;

      let parent = record.parentElement;
      while (parent && parent !== dialog) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      record.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editing]);

  return (
    <>
      <EditorTrigger
        onOpen={() => {
          onEditingChange(null);
          dialogRef.current?.showModal();
        }}
      />

      <dialog
        className="catalog-editor"
        onClose={() => onEditingChange(null)}
        ref={dialogRef}
      >
        <div className="editor-heading">
          <h2>数据管理</h2>
          <form method="dialog">
            <button type="submit" aria-label="关闭数据管理">
              ×
            </button>
          </form>
        </div>

        <CatalogBridgeControl ready={ready} snapshot={snapshot} />
        <DataTransfer readOnly={readOnly} snapshot={snapshot} />
        <details className="editor-create">
          <summary>
            {readOnly ? "添加作品（服务端控制中）" : "添加作品"}
          </summary>
          {!readOnly && <WorkForm />}
        </details>

        <div className="editor-work-list">
          {works.map((work) => (
            <section
              className="editor-work"
              data-record-id={work.id}
              key={work.id}
            >
              <div className="editor-record-heading">
                <h3>{work.title}</h3>
                <div className="editor-record-actions">
                  <button
                    disabled={readOnly}
                    type="button"
                    onClick={() =>
                      onEditingChange({ storeName: "works", id: work.id })
                    }
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCatalogWork(
                        snapshot,
                        work.id,
                        `todo-list-${work.title}`,
                      )
                    }
                  >
                    导出
                  </button>
                  <button
                    className="delete-action"
                    disabled={readOnly}
                    type="button"
                    onClick={() =>
                      handleDelete(
                        { storeName: "works", id: work.id },
                        `作品“${work.title}”`,
                      )
                    }
                  >
                    删除
                  </button>
                </div>
              </div>

              {!readOnly && isEditing("works", work.id) && (
                <WorkForm
                  work={work}
                  onCancel={() => onEditingChange(null)}
                  onSaved={() => onEditingChange(null)}
                />
              )}

              <details className="editor-children">
                <summary>出版物（{work.publications.length}）</summary>
                {!readOnly && <PublicationForm workId={work.id} />}

                {work.publications.map((publication) => (
                  <section
                    className="editor-publication"
                    data-record-id={publication.id}
                    data-undated={undatedIds.has(publication.id)}
                    key={publication.id}
                  >
                    <div className="editor-record-heading">
                      <strong>
                        {publication.category} · {publication.title}
                        {publication.timelineGroup &&
                          ` · ${publication.timelineGroup}`}
                      </strong>
                      <div className="editor-record-actions">
                        <button
                          disabled={readOnly}
                          type="button"
                          onClick={() =>
                            onEditingChange({
                              storeName: "publications",
                              id: publication.id,
                            })
                          }
                        >
                          编辑
                        </button>
                        <button
                          className="delete-action"
                          disabled={readOnly}
                          type="button"
                          onClick={() =>
                            handleDelete(
                              {
                                storeName: "publications",
                                id: publication.id,
                              },
                              `出版物“${publication.title}”`,
                            )
                          }
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    {!readOnly && isEditing("publications", publication.id) && (
                      <PublicationForm
                        publication={publication}
                        workId={work.id}
                        onCancel={() => onEditingChange(null)}
                        onSaved={() => onEditingChange(null)}
                      />
                    )}

                    <details className="editor-children">
                      <summary>集（{publication.episodes.length}）</summary>
                      {!readOnly && (
                        <EpisodeForm publicationId={publication.id} />
                      )}
                      {publication.episodes.length > 0 && (
                        <ul className="editor-episode-list">
                          {publication.episodes.map((episode) => (
                            <li
                              data-record-id={episode.id}
                              data-undated={undatedIds.has(episode.id)}
                              key={episode.id}
                            >
                              <div
                                className="editor-episode-content"
                                data-completed={episode.completed}
                                aria-disabled={readOnly}
                                onDoubleClick={(event) =>
                                  toggleCompletion(
                                    event,
                                    episode.id,
                                    episode.completed,
                                  )
                                }
                                title={
                                  readOnly ? "服务端控制中" : "双击切换完成状态"
                                }
                              >
                                <span>{episode.number}</span>
                                <strong>{episode.title}</strong>
                                {episode.date && <time>{episode.date}</time>}
                              </div>
                              <div className="editor-record-actions">
                                <button
                                  disabled={readOnly}
                                  type="button"
                                  onClick={() =>
                                    onEditingChange({
                                      storeName: "episodes",
                                      id: episode.id,
                                    })
                                  }
                                >
                                  编辑
                                </button>
                                <button
                                  className="delete-action"
                                  disabled={readOnly}
                                  type="button"
                                  onClick={() =>
                                    handleDelete(
                                      {
                                        storeName: "episodes",
                                        id: episode.id,
                                      },
                                      `集“${episode.number} ${episode.title}”`,
                                    )
                                  }
                                >
                                  删除
                                </button>
                              </div>
                              {!readOnly &&
                                isEditing("episodes", episode.id) && (
                                  <EpisodeForm
                                    episode={episode}
                                    publicationId={publication.id}
                                    onCancel={() => onEditingChange(null)}
                                    onSaved={() => onEditingChange(null)}
                                  />
                                )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </section>
                ))}
              </details>
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
};
