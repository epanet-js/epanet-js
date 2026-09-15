import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { splitsAtom } from "src/state/layout";
import { useShowAssetPanel } from "src/commands/show-asset-panel";

export const ASSET_PANEL_ANCHOR = "data-asset-panel";

export const useFocusAssetPanel = () => {
  const setSplits = useSetAtom(splitsAtom);
  const showAssetPanel = useShowAssetPanel();

  return useCallback(
    (autoOpen = false) => {
      if (autoOpen) {
        setSplits((splits) =>
          splits.rightOpen ? splits : { ...splits, rightOpen: true },
        );
        showAssetPanel();
      }

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
    [setSplits, showAssetPanel],
  );
};
