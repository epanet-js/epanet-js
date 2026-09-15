import { useCallback } from "react";
import { useShowAssetPanel } from "src/commands/show-asset-panel";

export const ASSET_PANEL_ANCHOR = "data-asset-panel";

export const useFocusAssetPanel = () => {
  const showAssetPanel = useShowAssetPanel();

  return useCallback(
    (autoOpen = false) => {
      if (autoOpen) showAssetPanel({ source: "draw" });

      const run = (attempt: number) => {
        const panel = document.querySelector(`[${ASSET_PANEL_ANCHOR}]`);
        if (!panel) {
          if (attempt < 5) requestAnimationFrame(() => run(attempt + 1));
          return;
        }

        requestAnimationFrame(() => {
          const target = panel.querySelector<HTMLElement>(
            '[aria-invalid="true"]',
          );
          target?.focus();
        });
      };

      requestAnimationFrame(() => run(0));
    },
    [showAssetPanel],
  );
};
