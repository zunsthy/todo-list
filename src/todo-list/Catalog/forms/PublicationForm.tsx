import type { FormEvent } from "react";
import type {
  Publication,
  PublicationFormProps,
} from "../../../types/catalog.js";
import { formValue } from "../../utils/form.js";
import { useCatalogActions } from "../context.js";

export const PublicationForm = ({
  workId,
  publication,
  onCancel,
  onSaved,
}: PublicationFormProps) => {
  const { addRecord, updateRecord } = useCatalogActions();

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

    const save = publication ? updateRecord : addRecord;
    void save({ storeName: "publications", dataList: [record] })
      .then(() => {
        if (!publication) form.reset();
        onSaved?.();
      })
      .catch(console.error);
  };

  return (
    <form className="catalog-form publication-form" onSubmit={handleSubmit}>
      <h4>{publication ? "编辑出版物" : "添加出版物"}</h4>
      <label>
        <span>类别</span>
        <input
          defaultValue={publication?.category}
          name="category"
          placeholder="小说 / 动画"
          required
        />
      </label>
      <label>
        <span>系列轨道</span>
        <input
          defaultValue={publication?.timelineGroup}
          name="timelineGroup"
          placeholder="本篇 / 外传"
        />
      </label>
      <label>
        <span>书名 / 剧名</span>
        <input defaultValue={publication?.title} name="title" required />
      </label>
      <label>
        <span>子名称</span>
        <input defaultValue={publication?.subtitle} name="subtitle" />
      </label>
      <label>
        <span>开始时间</span>
        <input defaultValue={publication?.date} name="date" type="date" />
      </label>
      <label>
        <span>结束时间</span>
        <input defaultValue={publication?.endDate} name="endDate" type="date" />
      </label>
      <label>
        <span>ISBN</span>
        <input defaultValue={publication?.isbn} name="isbn" />
      </label>
      <div className="form-actions">
        <button type="submit">{publication ? "保存" : "添加出版物"}</button>
        {publication && (
          <button type="button" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </form>
  );
};
