import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { splitsAtom, tabAtom, TabOption } from "src/state/layout";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const ASSET_PANEL_ANCHOR = "data-asset-panel";

export const useFocusAssetPanel = () => {
  const setSplits = useSetAtom(splitsAtom);
  const setTab = useSetAtom(tabAtom);
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");

  return useCallback(
    (autoOpen = false) => {
      if (!allowsNullValues) return;

      if (autoOpen) {
        setSplits((splits) =>
          splits.rightOpen ? splits : { ...splits, rightOpen: true },
        );
        setTab(TabOption.Asset);
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
    [setSplits, setTab, allowsNullValues],
  );
};
