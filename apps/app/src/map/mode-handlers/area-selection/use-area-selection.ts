import { useRef } from "react";
import { Position, HandlerContext } from "src/types";
import { useSelection, USelection } from "src/selection";
import { useSetAtom } from "jotai";
import { selectionAtom } from "src/state/selection";
import { runQuery } from "./run-query";
import { runCustomerPointsQuery } from "./run-customer-points-query";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useAreaSelection = (context: HandlerContext) => {
  const { selection, hydraulicModel } = context;
  const { selectAssets, clearSelection, extendSelection, removeFromSelection } =
    useSelection(selection);
  const setSelection = useSetAtom(selectionAtom);
  const isMultiCpSelectionOn = useFeatureFlag("FLAG_MULTI_CP_SELECTION");
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
      const assetIds = await runQuery(
        hydraulicModel,
        points,
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

      const customerPointIds = isMultiCpSelectionOn
        ? runCustomerPointsQuery(hydraulicModel, points)
        : [];

      if (assetIds.length === 0 && customerPointIds.length === 0) {
        if (!operation) {
          clearSelection();
        }
        return;
      }

      if (isMultiCpSelectionOn && customerPointIds.length > 0) {
        setSelection(
          USelection.applyKindedOperation(
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
