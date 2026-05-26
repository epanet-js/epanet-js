import { useRef } from "react";
import { Position, HandlerContext } from "src/types";
import { useSelection } from "src/selection";
import { runQuery } from "./run-query";
import { captureError } from "src/infra/error-tracking";

export const useAreaSelection = (context: HandlerContext) => {
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
      const assetIds = await runQuery(
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
