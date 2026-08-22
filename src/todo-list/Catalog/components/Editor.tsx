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
import { buildTimeline } from "../model/timeline.js";
import { DataTransfer } from "./DataTransfer.js";
import { EditorTrigger } from "./EditorTrigger.js";

export const Editor = ({
  works,
  snapshot,
  editing,
  onEditingChange,
}: CatalogEditorProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { deleteRecord, setCompletion } = useCatalogActions();
  const undatedIds = useMemo(
    () =>
      new Set(
        buildTimeline(works).works.flatMap(({ undated }) =>
          undated.map(({ target }) => target.id),
        ),
      ),
    [works],
  );

  const isEditing = (storeName: CatalogEntityStoreName, id: string): boolean =>
    editing?.storeName === storeName && editing.id === id;

  const handleDelete = (target: CatalogRecordTarget, label: string): void => {
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

        <DataTransfer snapshot={snapshot} />
        <details className="editor-create">
          <summary>添加作品</summary>
          <WorkForm />
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
                    type="button"
                    onClick={() =>
                      onEditingChange({ storeName: "works", id: work.id })
                    }
                  >
                    编辑
                  </button>
                  <button
                    className="delete-action"
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

              {isEditing("works", work.id) && (
                <WorkForm
                  work={work}
                  onCancel={() => onEditingChange(null)}
                  onSaved={() => onEditingChange(null)}
                />
              )}

              <details className="editor-children">
                <summary>出版物（{work.publications.length}）</summary>
                <PublicationForm workId={work.id} />

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

                    {isEditing("publications", publication.id) && (
                      <PublicationForm
                        publication={publication}
                        workId={work.id}
                        onCancel={() => onEditingChange(null)}
                        onSaved={() => onEditingChange(null)}
                      />
                    )}

                    <details className="editor-children">
                      <summary>集（{publication.episodes.length}）</summary>
                      <EpisodeForm publicationId={publication.id} />
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
                                onDoubleClick={(event) =>
                                  toggleCompletion(
                                    event,
                                    episode.id,
                                    episode.completed,
                                  )
                                }
                                title="双击切换完成状态"
                              >
                                <span>{episode.number}</span>
                                <strong>{episode.title}</strong>
                                {episode.date && <time>{episode.date}</time>}
                              </div>
                              <div className="editor-record-actions">
                                <button
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
                              {isEditing("episodes", episode.id) && (
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
