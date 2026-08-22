import type { FormEvent } from "react";
import type { Work, WorkFormProps } from "../../../types/catalog.js";
import { formListValue, formValue } from "../../utils/form.js";
import { useCatalogActions } from "../context.js";

export const WorkForm = ({ work, onCancel, onSaved }: WorkFormProps) => {
  const { addRecord, updateRecord } = useCatalogActions();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const record: Work = {
      id: work?.id ?? window.crypto.randomUUID(),
      title: formValue(formData, "title"),
      coverUrl: formValue(formData, "coverUrl"),
      aliases: formListValue(formData, "aliases"),
      authors: formListValue(formData, "authors"),
      otherInfo: formValue(formData, "otherInfo"),
    };

    const save = work ? updateRecord : addRecord;
    void save({ storeName: "works", dataList: [record] })
      .then(() => {
        if (!work) form.reset();
        onSaved?.();
      })
      .catch(console.error);
  };

  return (
    <form className="catalog-form work-form" onSubmit={handleSubmit}>
      <h3>{work ? "编辑作品" : "添加作品"}</h3>
      <label>
        <span>作品名</span>
        <input defaultValue={work?.title} name="title" required />
      </label>
      <label>
        <span>封面地址</span>
        <input
          defaultValue={work?.coverUrl}
          name="coverUrl"
          type="url"
          placeholder="https://…"
        />
      </label>
      <label>
        <span>别名</span>
        <input
          defaultValue={work?.aliases.join(", ")}
          name="aliases"
          placeholder="多个别名用逗号分隔"
        />
      </label>
      <label>
        <span>作者</span>
        <input
          defaultValue={work?.authors.join(", ")}
          name="authors"
          placeholder="多个作者用逗号分隔"
        />
      </label>
      <label className="wide-field">
        <span>其他信息</span>
        <textarea defaultValue={work?.otherInfo} name="otherInfo" rows={2} />
      </label>
      <div className="form-actions">
        <button type="submit">{work ? "保存" : "添加作品"}</button>
        {work && (
          <button type="button" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </form>
  );
};
