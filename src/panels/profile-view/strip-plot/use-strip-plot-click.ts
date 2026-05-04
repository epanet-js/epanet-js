import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { selectionAtom } from "src/state/selection";
import { tabAtom, TabOption } from "src/state/layout";
import { USelection } from "src/selection/selection";

export function useStripPlotClick(): (params: any) => void {
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);

  return useCallback(
    (params: any) => {
      const data = params?.data;
      const linkId: number | undefined = data?.linkId;
      const nodeId: number | undefined = data?.nodeId;
      const assetId = linkId ?? nodeId;
      if (typeof assetId !== "number") return;
      setSelection(USelection.single(assetId));
      setTab(TabOption.Asset);
    },
    [setSelection, setTab],
  );
}
