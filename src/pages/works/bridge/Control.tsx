import { useCatalogBridge } from "./context.ts";
import {
  BridgeControl,
  BridgeBanner,
} from "../../../shared/bridge/Control.tsx";

export const CatalogBridgeControl = ({ ready }: { ready: boolean }) => {
  const bridge = useCatalogBridge();
  return (
    <BridgeControl
      bridge={bridge}
      ready={ready}
      onToggle={() => {
        if (bridge.enabled) bridge.disable();
        else if (ready) {
          bridge.enable(crypto.randomUUID());
        }
      }}
    />
  );
};

export const CatalogBridgeBanner = () => (
  <BridgeBanner bridge={useCatalogBridge()} />
);
