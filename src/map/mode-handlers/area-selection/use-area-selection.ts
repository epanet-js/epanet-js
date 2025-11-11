import { useRef } from "react";
import { Position, HandlerContext } from "src/types";
import { useSelection } from "src/selection";
import { runQuery } from "./run-query";

export const useAreaSelection = (context: HandlerContext) => {
  const { selection, hydraulicModel } = context;
  const { selectAssets, clearSelection } = useSelection(selection);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectContainedAssets = async (points: Position[]): Promise<void> => {
    if (!!abortControllerRef.current) {
      abortControllerRef.current?.abort();
    }

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
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  };

  const abort = () => {
    if (!!abortControllerRef.current) abortControllerRef.current?.abort();
  };

  return { selectContainedAssets, abort };
};
