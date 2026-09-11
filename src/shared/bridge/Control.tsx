import type { BridgeStatus } from "./types.ts";

export interface BridgeControlState {
  available: boolean;
  enabled: boolean;
  status: BridgeStatus;
  pageId: string | null;
  error: string | null;
  disable(): void;
}
const statusLabel = {
  disabled: "已关闭",
  connecting: "正在连接",
  connected: "已连接",
  reconnecting: "正在重新连接",
  error: "连接异常",
} as const;

export const BridgeControl = ({
  bridge,
  ready,
  onToggle,
}: {
  bridge: BridgeControlState;
  ready: boolean;
  onToggle(): void;
}) => {
  if (!bridge.available) return null;
  return (
    <section className="data-bridge-control">
      <label>
        <input
          checked={bridge.enabled}
          disabled={!ready}
          onChange={onToggle}
          type="checkbox"
        />
        <span>允许服务端操作数据</span>
      </label>
      <small>{ready ? statusLabel[bridge.status] : "正在准备数据"}</small>
      {bridge.pageId && (
        <div className="data-bridge-page-id">
          <code>{bridge.pageId}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(bridge.pageId!)
                .catch(console.error);
            }}
          >
            复制页面 ID
          </button>
        </div>
      )}
      {bridge.error && <p role="alert">{bridge.error}</p>}
    </section>
  );
};

export const BridgeBanner = ({ bridge }: { bridge: BridgeControlState }) => {
  if (!bridge.enabled) return null;
  return (
    <aside
      className="data-bridge-banner"
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
