import { useRef } from "react";
import { Position, HandlerContext } from "src/types";
import { useSelection } from "src/selection";
import { runQuery } from "./run-query";
import { captureError } from "src/infra/error-tracking";

export const useAreaSelection = (context: HandlerContext) => {
  const { selection, hydraulicModel } = context;
  const { selectAssets, clearSelection } = useSelection(selection);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      const assetIds = await runQuery(
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
