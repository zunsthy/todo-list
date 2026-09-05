import type { FormEvent } from "react";
import type {
  Publication,
  PublicationFormProps,
} from "../../../types/catalog.js";
import { formValue } from "../../utils/form.js";
import { useRecordSave } from "./useRecordSave.js";

export const PublicationForm = ({
  workId,
  publication,
  onCancel,
  onSaved,
}: PublicationFormProps) => {
  const { save, saving, error } = useRecordSave(Boolean(publication), onSaved);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const record: Publication = {
      id: publication?.id ?? window.crypto.randomUUID(),
      workId,
      category: formValue(formData, "category"),
      timelineGroup: formValue(formData, "timelineGroup"),
      title: formValue(formData, "title"),
      subtitle: formValue(formData, "subtitle"),
      date: formValue(formData, "date"),
      endDate: formValue(formData, "endDate"),
      isbn: formValue(formData, "isbn"),
    };

    save(form, { storeName: "publications", dataList: [record] });
  };

  return (
    <form
      className="catalog-form publication-form"
      onSubmit={handleSubmit}
      aria-busy={saving}
    >
      <h4>{publication ? "编辑出版物" : "添加出版物"}</h4>
      <label>
        <span>类别</span>
        <input
          defaultValue={publication?.category}
          disabled={saving}
          name="category"
          placeholder="小说 / 动画"
          required
        />
      </label>
      <label>
        <span>系列轨道</span>
        <input
          defaultValue={publication?.timelineGroup}
          disabled={saving}
          name="timelineGroup"
          placeholder="本篇 / 外传"
        />
      </label>
      <label>
        <span>书名 / 剧名</span>
        <input
          defaultValue={publication?.title}
          name="title"
          required
          disabled={saving}
        />
      </label>
      <label>
        <span>子名称</span>
        <input
          defaultValue={publication?.subtitle}
          name="subtitle"
          disabled={saving}
        />
      </label>
      <label>
        <span>开始时间</span>
        <input
          defaultValue={publication?.date}
          name="date"
          type="date"
          disabled={saving}
        />
      </label>
      <label>
        <span>结束时间</span>
        <input
          defaultValue={publication?.endDate}
          name="endDate"
          type="date"
          disabled={saving}
        />
      </label>
      <label>
        <span>ISBN</span>
        <input defaultValue={publication?.isbn} name="isbn" disabled={saving} />
      </label>
      {error && (
        <p className="form-error" role="alert">
          保存失败：{error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? "正在保存…" : publication ? "保存" : "添加出版物"}
        </button>
        {publication && (
          <button type="button" onClick={onCancel} disabled={saving}>
            取消
          </button>
        )}
      </div>
    </form>
  );
};
