import type { SubmitEvent } from "react";
import type { Episode, EpisodeFormProps } from "../../../types/catalog.js";
import { formValue } from "../../utils/form.js";
import { useRecordSave } from "./useRecordSave.js";

export const EpisodeForm = ({
  publicationId,
  episode,
  onCancel,
  onSaved,
}: EpisodeFormProps) => {
  const { save, saving, error } = useRecordSave(Boolean(episode), onSaved);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const record: Episode = {
      id: episode?.id ?? window.crypto.randomUUID(),
      publicationId,
      number: formValue(formData, "number"),
      title: formValue(formData, "title"),
      date: formValue(formData, "date"),
    };

    save(form, { storeName: "episodes", dataList: [record] });
  };

  return (
    <form
      className="catalog-form episode-form"
      onSubmit={handleSubmit}
      aria-busy={saving}
    >
      <h5>{episode ? "编辑集" : "添加集"}</h5>
      <label>
        <span>集数</span>
        <input
          defaultValue={episode?.number}
          disabled={saving}
          name="number"
          placeholder="01 / EX"
          required
        />
      </label>
      <label>
        <span>名称</span>
        <input
          defaultValue={episode?.title}
          name="title"
          required
          disabled={saving}
        />
      </label>
      <label>
        <span>时间</span>
        <input
          defaultValue={episode?.date}
          name="date"
          type="date"
          disabled={saving}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          保存失败：{error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? "正在保存…" : episode ? "保存" : "添加集"}
        </button>
        {episode && (
          <button type="button" onClick={onCancel} disabled={saving}>
            取消
          </button>
        )}
      </div>
    </form>
  );
};
