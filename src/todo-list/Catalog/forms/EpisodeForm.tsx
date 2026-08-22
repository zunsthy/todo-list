import type { SubmitEvent } from "react";
import type { Episode, EpisodeFormProps } from "../../../types/catalog.js";
import { formValue } from "../../utils/form.js";
import { useCatalogActions } from "../context.js";

export const EpisodeForm = ({
  publicationId,
  episode,
  onCancel,
  onSaved,
}: EpisodeFormProps) => {
  const { addRecord, updateRecord } = useCatalogActions();

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

    const save = episode ? updateRecord : addRecord;
    void save({ storeName: "episodes", dataList: [record] })
      .then(() => {
        if (!episode) form.reset();
        onSaved?.();
      })
      .catch(console.error);
  };

  return (
    <form className="catalog-form episode-form" onSubmit={handleSubmit}>
      <h5>{episode ? "编辑集" : "添加集"}</h5>
      <label>
        <span>集数</span>
        <input
          defaultValue={episode?.number}
          name="number"
          placeholder="01 / EX"
          required
        />
      </label>
      <label>
        <span>名称</span>
        <input defaultValue={episode?.title} name="title" required />
      </label>
      <label>
        <span>时间</span>
        <input defaultValue={episode?.date} name="date" type="date" />
      </label>
      <div className="form-actions">
        <button type="submit">{episode ? "保存" : "添加集"}</button>
        {episode && (
          <button type="button" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </form>
  );
};
