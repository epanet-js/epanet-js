import { useRef } from "react";
import { Position, HandlerContext } from "src/types";
import { useSelection } from "src/selection";
import { runContainedAssetsQuery } from "./run-contained-assets-query";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { runIntersectedAssetsQuery } from "./run-intersected-assets-query";

export const useAreaSelection = (context: HandlerContext) => {
  const { selection, hydraulicModel } = context;
  const { selectAssets, clearSelection } = useSelection(selection);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPrecisionSelection = useFeatureFlag("FLAG_PRECISION_SELECTION");

  const abort = () => {
    if (!!abortControllerRef.current) {
      abortControllerRef.current?.abort();
    }
  };

  const selectAssetsInArea = async (points: Position[]): Promise<void> => {
    abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const assetIds = isPrecisionSelection
        ? await runContainedAssetsQuery(
            hydraulicModel,
            points,
            controller.signal,
          )
        : await runIntersectedAssetsQuery(
            hydraulicModel,
            points,
            controller.signal,
          );

      if (controller.signal.aborted) {
        return;
      }

      if (assetIds.length > 0) {
        selectAssets(assetIds);
      } else {
        clearSelection();
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
