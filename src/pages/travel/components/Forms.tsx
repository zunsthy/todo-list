import { useState } from "react";
import type { FormEvent } from "react";
import { formListValue, formValue } from "../../../shared/utils/form.js";
import { buildTree, parseFootprint, parsePos, parseRegion } from "../model.ts";
import { coordinateSystems, visitTypes } from "../types.ts";
import type { Footprint, Pos, Region, TravelSnapshot } from "../types.ts";

const readPos = (form: FormData): Pos | null => {
  const longitude = formValue(form, "longitude"),
    latitude = formValue(form, "latitude"),
    coordinateSystem = formValue(form, "coordinateSystem");
  if (!longitude && !latitude && !coordinateSystem) return null;
  if (!longitude || !latitude || !coordinateSystem)
    throw new Error("经度、纬度和坐标系必须同时填写，或全部留空");
  return parsePos({
    coordinates: [Number(longitude), Number(latitude)],
    coordinateSystem,
  });
};
export const PosFields = ({ pos }: { pos: Pos | null }) => (
  <fieldset className="travel-position">
    <legend>地图标注点（可全部留空）</legend>
    <label>
      经度
      <input
        name="longitude"
        type="number"
        step="any"
        min="-180"
        max="180"
        defaultValue={pos?.coordinates[0]}
      />
    </label>
    <label>
      纬度
      <input
        name="latitude"
        type="number"
        step="any"
        min="-90"
        max="90"
        defaultValue={pos?.coordinates[1]}
      />
    </label>
    <label>
      坐标系
      <select
        name="coordinateSystem"
        defaultValue={pos?.coordinateSystem ?? ""}
      >
        <option value="">请选择坐标系</option>
        {coordinateSystems.map((system) => (
          <option key={system}>{system}</option>
        ))}
      </select>
    </label>
    <small>坐标与坐标系必须成对保存，不需要精确到实际到访地点。</small>
  </fieldset>
);
const useSubmit = (submit: (data: FormData) => Promise<void>) => {
  const [error, setError] = useState("");
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      await submit(new FormData(event.currentTarget));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试");
    }
  };
  return { onSubmit, error };
};
const FormActions = ({
  busy,
  error,
  onCancel,
}: {
  busy: boolean;
  error: string;
  onCancel: () => void;
}) => (
  <>
    {error && (
      <p className="travel-error" role="alert">
        {error}
      </p>
    )}
    <div className="travel-actions">
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "正在保存…" : "保存"}
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        取消
      </button>
    </div>
  </>
);

export const RegionForm = ({
  region,
  parentId,
  busy,
  onSave,
  onCancel,
}: {
  region: Region | null;
  parentId: string | null;
  busy: boolean;
  onSave: (region: Region) => Promise<void>;
  onCancel: () => void;
}) => {
  const { onSubmit, error } = useSubmit(async (form) =>
    onSave(
      parseRegion({
        id: region?.id ?? formValue(form, "id"),
        parentId,
        name: formValue(form, "name"),
        aliases: formListValue(form, "aliases"),
        kind: parentId === null ? "国家" : formValue(form, "kind"),
        classification: formValue(form, "classification"),
        sortOrder: Number(formValue(form, "sortOrder")),
        notes: formValue(form, "notes"),
        pos: readPos(form),
        boundaryKey: formValue(form, "boundaryKey") || null,
        state: region?.state ?? "unloaded",
        ...(region?.importedAt ? { importedAt: region.importedAt } : {}),
      }),
    ),
  );
  return (
    <form className="travel-form" onSubmit={onSubmit} aria-busy={busy}>
      <fieldset disabled={busy}>
        <label>
          地区编码
          <input
            name="id"
            required
            defaultValue={region?.id}
            disabled={Boolean(region)}
            placeholder={parentId === null ? "如 CN、MM" : "如 110114、MM-1506"}
            autoFocus
          />
        </label>
        <label>
          地区名称
          <input name="name" required defaultValue={region?.name} />
        </label>
        {parentId !== null && (
          <label>
            地区级别
            <input
              name="kind"
              required
              defaultValue={region?.kind ?? "区"}
              placeholder="省、市、县、区、新区、州…"
            />
          </label>
        )}
        <label>
          地区类别
          <select
            name="classification"
            defaultValue={region?.classification ?? "administrative"}
          >
            <option value="administrative">行政区划</option>
            <option value="functional">功能／管理区域</option>
            <option value="custom">自定义地区</option>
          </select>
        </label>
        <label>
          别名
          <input
            name="aliases"
            defaultValue={region?.aliases.join("，")}
            placeholder="多个别名用逗号分隔"
          />
        </label>
        <label>
          排序
          <input
            name="sortOrder"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={region?.sortOrder ?? 0}
          />
        </label>
        <small>
          {parentId === null
            ? "国家使用两位大写代码；不会自动导入下级。"
            : `父级编码：${parentId}。中国使用六位 adcode，国外编码保留国家前缀。`}
        </small>
        <PosFields pos={region?.pos ?? null} />
        <label className="travel-form-full">
          边界 key
          <input
            name="boundaryKey"
            defaultValue={region?.boundaryKey ?? ""}
            placeholder="可留空；填写时必须已导入对应边界"
          />
        </label>
        <label className="travel-form-full">
          说明
          <textarea name="notes" rows={3} defaultValue={region?.notes} />
        </label>
      </fieldset>
      <FormActions busy={busy} error={error} onCancel={onCancel} />
    </form>
  );
};

export const FootprintForm = ({
  footprint,
  initialRegionId,
  snapshot,
  busy,
  onSave,
  onCancel,
}: {
  footprint: Footprint | null;
  initialRegionId: string;
  snapshot: TravelSnapshot;
  busy: boolean;
  onSave: (footprint: Footprint) => Promise<void>;
  onCancel: () => void;
}) => {
  const tree = buildTree(snapshot);
  const [regionId, setRegionId] = useState(
    footprint?.regionId ?? initialRegionId,
  );
  const options = snapshot.regions
    .filter(
      (region) => tree.isLeaf(region.id) || footprint?.regionId === region.id,
    )
    .sort((a, b) =>
      tree
        .path(a.id)
        .map((region) => region.name)
        .join("/")
        .localeCompare(
          tree
            .path(b.id)
            .map((region) => region.name)
            .join("/"),
          "zh-CN",
        ),
    );
  const { onSubmit, error } = useSubmit(async (form) =>
    onSave(
      parseFootprint({
        id: footprint?.id ?? crypto.randomUUID(),
        name: formValue(form, "name"),
        regionId,
        time: formValue(form, "time") || null,
        visitType: formValue(form, "visitType"),
        notes: formValue(form, "notes"),
        pos: readPos(form),
      }),
    ),
  );
  return (
    <form className="travel-form" onSubmit={onSubmit} aria-busy={busy}>
      <fieldset disabled={busy}>
        <label>
          足迹名称
          <input
            name="name"
            required
            autoFocus
            defaultValue={
              footprint?.name ?? `${tree.byId.get(regionId)?.name ?? ""}到访`
            }
          />
        </label>
        <label>
          所属地区
          <select
            name="regionId"
            value={regionId}
            onChange={(event) => setRegionId(event.target.value)}
            required
          >
            {options.map((region) => (
              <option key={region.id} value={region.id}>
                {tree
                  .path(region.id)
                  .map((item) => item.name)
                  .join(" / ")}
                {tree.isLeaf(region.id) ? "" : "（保留原地区）"}
              </option>
            ))}
          </select>
        </label>
        <label>
          时间
          <input
            name="time"
            defaultValue={footprint?.time ?? ""}
            placeholder="YYYY、YYYY-MM 或 YYYY-MM-DD"
          />
        </label>
        <label>
          到访方式
          <select
            name="visitType"
            defaultValue={footprint?.visitType ?? "旅游"}
          >
            {visitTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <small>只记录一个时间；不记得时可以留空。</small>
        <label className="travel-form-full">
          说明
          <textarea name="notes" rows={4} defaultValue={footprint?.notes} />
        </label>
        <PosFields
          key={regionId}
          pos={regionId === footprint?.regionId ? footprint.pos : null}
        />
        <small>位置留空时沿用所属地区的坐标和坐标系。</small>
      </fieldset>
      <FormActions busy={busy} error={error} onCancel={onCancel} />
    </form>
  );
};
