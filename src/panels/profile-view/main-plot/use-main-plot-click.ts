import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { selectionAtom } from "src/state/selection";
import { tabAtom, TabOption } from "src/state/layout";
import { USelection } from "src/selection/selection";
import { ProfilePoint } from "../chart-data";

export function useMainPlotClick(
  points: ProfilePoint[],
): (params: any) => void {
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);

  return useCallback(
    (params: any) => {
      const idx: number | undefined = params?.dataIndex;
      if (typeof idx !== "number") return;
      const point = points[idx];
      if (!point) return;
      setSelection(USelection.single(point.nodeId));
      setTab(TabOption.Asset);
    },
    [points, setSelection, setTab],
  );
}
