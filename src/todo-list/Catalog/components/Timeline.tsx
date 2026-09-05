import { memo, type MouseEvent } from "react";
import type {
  CatalogRecordTarget,
  CatalogTimelineProps,
  TimelineStyle,
} from "../../../types/catalog.js";
import { useCatalogActions } from "../context.js";
import { useCatalogBridge } from "../../bridge/context.js";

export const Timeline = memo(({ timeline, onEdit }: CatalogTimelineProps) => {
  const { setCompletion } = useCatalogActions();
  const catalogBridge = useCatalogBridge();
  const readOnly = catalogBridge.enabled;

  const toggleCompletion = (
    event: MouseEvent<HTMLElement>,
    id: string,
    completed: boolean,
  ): void => {
    event.preventDefault();
    if (readOnly) return;
    void setCompletion(id, !completed).catch(console.error);
  };

  const editRecord = (
    event: MouseEvent<HTMLElement>,
    target: CatalogRecordTarget,
  ): void => {
    event.preventDefault();
    if (readOnly) return;
    onEdit(target);
  };

  if (timeline.works.length === 0) {
    return <p className="empty-state">还没有作品，请先在数据管理中添加。</p>;
  }

  const gridStyle: TimelineStyle = {
    "--quarter-count": timeline.quarterCount,
  };

  return (
    <section
      className="timeline-panel"
      aria-label="作品时间轴"
      data-server-controlled={readOnly}
    >
      <div className="timeline-grid" style={gridStyle}>
        <div className="timeline-axis timeline-row">
          <div className="timeline-corner" aria-hidden="true" />
          <div className="timeline-years">
            {timeline.years.map(({ year, startColumn }) => (
              <div
                className="timeline-year"
                key={year}
                style={{ gridColumn: `${startColumn} / span 4` }}
              >
                <strong>{year}</strong>
              </div>
            ))}
          </div>
        </div>

        {timeline.works.map(({ work, tracks, undated }) => (
          <article className="timeline-work timeline-row" key={work.id}>
            <figure
              className="work-cover"
              data-completed={work.completed}
              aria-disabled={readOnly}
              onDoubleClick={(event) =>
                toggleCompletion(event, work.id, work.completed)
              }
              onContextMenu={(event) =>
                editRecord(event, { storeName: "works", id: work.id })
              }
              title={readOnly ? "服务端控制中" : "双击切换完成状态，右键编辑"}
            >
              {work.coverUrl ? (
                <img
                  src={work.coverUrl}
                  alt={`${work.title}封面`}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="cover-placeholder" aria-hidden="true">
                  {work.title.slice(0, 2)}
                </div>
              )}
              <figcaption>
                <strong>{work.title}</strong>
                {work.aliases.length > 0 && (
                  <small>{work.aliases.join(" / ")}</small>
                )}
                {undated.length > 0 && (
                  <small>未在时间轴：{undated.length} 项</small>
                )}
              </figcaption>
            </figure>

            <div className="work-tracks">
              {tracks.length === 0 && (
                <p className="no-dated-publication">暂无已定档内容</p>
              )}
              {tracks.map(({ category, groups }) => (
                <section className="timeline-track" key={category}>
                  <h4 className="track-label">{category}</h4>
                  {groups.map(({ name, lanes }) => (
                    <section className="timeline-group" key={name}>
                      <h5 className="group-label">{name}</h5>
                      {lanes.map(({ entries }, laneIndex) => (
                        <div className="timeline-lane" key={laneIndex}>
                          {entries.map(
                            ({
                              items,
                              startColumn,
                              span,
                              startInset = 0,
                              endInset = 0,
                              color,
                            }) => {
                              const itemStyle: TimelineStyle = {
                                gridColumn: `${startColumn} / span ${span}`,
                                ...(startInset > 0 && {
                                  marginInlineStart: `calc(0.1rem + ${(startInset / span) * 100}%)`,
                                }),
                                ...(endInset > 0 && {
                                  marginInlineEnd: `calc(0.1rem + ${(endInset / span) * 100}%)`,
                                }),
                                "--item-color": color,
                              };

                              return (
                                <span
                                  className="timeline-cell"
                                  key={items.map(({ key }) => key).join("|")}
                                  style={itemStyle}
                                >
                                  {items.map((item) => (
                                    <span
                                      className="timeline-item"
                                      data-completed={item.completed}
                                      aria-disabled={readOnly}
                                      key={item.key}
                                      onDoubleClick={(event) =>
                                        toggleCompletion(
                                          event,
                                          item.target.id,
                                          item.completed,
                                        )
                                      }
                                      onContextMenu={(event) =>
                                        editRecord(event, item.target)
                                      }
                                      title={
                                        readOnly
                                          ? `${item.title} ${item.subtitle} · 服务端控制中`
                                          : `${item.title} ${item.subtitle} · 双击切换完成状态，右键编辑`
                                      }
                                    >
                                      <span className="timeline-item-heading">
                                        <strong>{item.title}</strong>
                                      </span>
                                      {item.subtitle && (
                                        <small>{item.subtitle}</small>
                                      )}
                                      <small>
                                        {item.date}
                                        {item.endDate && ` — ${item.endDate}`}
                                      </small>
                                      {item.episodeCount > 0 && (
                                        <small>{item.episodeCount}</small>
                                      )}
                                    </span>
                                  ))}
                                </span>
                              );
                            },
                          )}
                        </div>
                      ))}
                    </section>
                  ))}
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
});
