import { useRef } from "react";
import { Position, HandlerContext } from "src/types";
import { useSelection, USelection } from "src/selection";
import { useAtomValue, useSetAtom } from "jotai";
import { selectionAtom } from "src/state/selection";
import { customerPointsVisibleAtom } from "src/state/map-symbology";
import { runQuery } from "./run-query";
import { captureError } from "src/infra/error-tracking";

export const useAreaSelection = (context: HandlerContext) => {
  const { selection, hydraulicModel } = context;
  const { selectAssets, clearSelection, extendSelection, removeFromSelection } =
    useSelection(selection);
  const setSelection = useSetAtom(selectionAtom);
  const customerPointsVisible = useAtomValue(customerPointsVisibleAtom);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = () => {
    if (!!abortControllerRef.current) {
      abortControllerRef.current?.abort();
    }
  };

  const selectAssetsInArea = async (
    points: Position[],
    operation?: "add" | "subtract",
  ): Promise<void> => {
    abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { assetIds, customerPointIds } = await runQuery(
        hydraulicModel,
        points,
        controller.signal,
        undefined,
        customerPointsVisible,
      );

      if (controller.signal.aborted) {
        return;
      }

      if (assetIds.length === 0 && customerPointIds.length === 0) {
        if (!operation) {
          clearSelection();
        }
        return;
      }

      if (customerPointIds.length > 0) {
        setSelection(
          USelection.applyOperation(
            selection,
            { assetIds, customerPointIds },
            operation,
          ),
        );
        return;
      }

      if (operation === "add") {
        extendSelection(assetIds);
      } else if (operation === "subtract") {
        removeFromSelection(assetIds);
      } else {
        selectAssets(assetIds);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      captureError(error as Error);
    } finally {
      abortControllerRef.current = null;
    }
  };

  return { selectAssetsInArea, abort };
};
