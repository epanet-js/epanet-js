import { useRef } from "react";
import { Position, HandlerContext } from "src/types";
import { useSelection, USelection } from "src/selection";
import { useSetAtom } from "jotai";
import { selectionAtom } from "src/state/selection";
import { runQueryDeprecated, runQueryNew } from "./run-query";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useAreaSelection = (context: HandlerContext) => {
  const isMultiCpSelectionOn = useFeatureFlag("FLAG_MULTI_CP_SELECTION");
  const areaSelectionDeprecated = useAreaSelectionDeprecated(context);
  const areaSelectionNew = useAreaSelectionNew(context);
  return isMultiCpSelectionOn ? areaSelectionNew : areaSelectionDeprecated;
};

const useAreaSelectionDeprecated = (context: HandlerContext) => {
  const { selection, hydraulicModel } = context;
  const { selectAssets, clearSelection, extendSelection, removeFromSelection } =
    useSelection(selection);
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
      const assetIds = await runQueryDeprecated(
        hydraulicModel,
        points,
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

      if (assetIds.length === 0) {
        if (!operation) {
          clearSelection();
        }
      } else {
        if (operation === "add") {
          extendSelection(assetIds);
        } else if (operation === "subtract") {
          removeFromSelection(assetIds);
        } else {
          selectAssets(assetIds);
        }
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

const useAreaSelectionNew = (context: HandlerContext) => {
  const { selection, hydraulicModel } = context;
  const { selectAssets, clearSelection, extendSelection, removeFromSelection } =
    useSelection(selection);
  const setSelection = useSetAtom(selectionAtom);
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
      const { assetIds, customerPointIds } = await runQueryNew(
        hydraulicModel,
        points,
        controller.signal,
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
