import type { CatalogSnapshot } from "../../types/catalog.js";
import { downloadCatalogBeforeServerControl } from "../Catalog/utils/download.js";
import { useCatalogBridge } from "./context.js";

const statusLabel = {
  disabled: "已关闭",
  connecting: "正在连接",
  connected: "已连接",
  reconnecting: "正在重新连接",
  error: "连接异常",
} as const;

export const CatalogBridgeControl = ({
  snapshot,
  ready,
}: {
  snapshot: CatalogSnapshot;
  ready: boolean;
}) => {
  const bridge = useCatalogBridge();
  if (!bridge.available) return null;

  const toggle = (): void => {
    if (bridge.enabled) {
      bridge.disable();
      return;
    }
    if (!ready) return;
    downloadCatalogBeforeServerControl(snapshot);
    bridge.enable(window.crypto.randomUUID());
  };

  const copyPageId = (): void => {
    if (!bridge.pageId) return;
    void window.navigator.clipboard
      .writeText(bridge.pageId)
      .catch(console.error);
  };

  return (
    <section className="catalog-bridge-control">
      <label>
        <input
          checked={bridge.enabled}
          disabled={!ready}
          onChange={toggle}
          type="checkbox"
        />
        <span>允许服务端操作数据</span>
      </label>
      <small>{ready ? statusLabel[bridge.status] : "正在读取数据库"}</small>
      {bridge.pageId && (
        <div className="catalog-bridge-page-id">
          <code>{bridge.pageId}</code>
          <button onClick={copyPageId} type="button">
            复制页面 ID
          </button>
        </div>
      )}
      {bridge.error && <p role="alert">{bridge.error}</p>}
    </section>
  );
};

export const CatalogBridgeBanner = () => {
  const bridge = useCatalogBridge();
  if (!bridge.enabled) return null;
  return (
    <aside
      className="catalog-bridge-banner"
      data-status={bridge.status}
      role="status"
    >
      <strong>服务端数据控制已开启</strong>
      <span>{statusLabel[bridge.status]}</span>
      {bridge.pageId && <code>{bridge.pageId}</code>}
      <span>页面写操作已禁用</span>
      <button onClick={bridge.disable} type="button">
        关闭连接
      </button>
    </aside>
  );
};
