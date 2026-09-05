import type { FormEvent } from "react";
import type { Work, WorkFormProps } from "../../../types/catalog.js";
import { formListValue, formValue } from "../../utils/form.js";
import { useRecordSave } from "./useRecordSave.js";

export const WorkForm = ({ work, onCancel, onSaved }: WorkFormProps) => {
  const { save, saving, error } = useRecordSave(Boolean(work), onSaved);

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

    save(form, { storeName: "works", dataList: [record] });
  };

  return (
    <form
      className="catalog-form work-form"
      onSubmit={handleSubmit}
      aria-busy={saving}
    >
      <h3>{work ? "编辑作品" : "添加作品"}</h3>
      <label>
        <span>作品名</span>
        <input
          defaultValue={work?.title}
          name="title"
          required
          disabled={saving}
        />
      </label>
      <label>
        <span>封面地址</span>
        <input
          defaultValue={work?.coverUrl}
          disabled={saving}
          name="coverUrl"
          type="url"
          placeholder="https://…"
        />
      </label>
      <label>
        <span>别名</span>
        <input
          defaultValue={work?.aliases.join(", ")}
          disabled={saving}
          name="aliases"
          placeholder="多个别名用逗号分隔"
        />
      </label>
      <label>
        <span>作者</span>
        <input
          defaultValue={work?.authors.join(", ")}
          disabled={saving}
          name="authors"
          placeholder="多个作者用逗号分隔"
        />
      </label>
      <label className="wide-field">
        <span>其他信息</span>
        <textarea
          defaultValue={work?.otherInfo}
          name="otherInfo"
          rows={2}
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
          {saving ? "正在保存…" : work ? "保存" : "添加作品"}
        </button>
        {work && (
          <button type="button" onClick={onCancel} disabled={saving}>
            取消
          </button>
        )}
      </div>
    </form>
  );
};
