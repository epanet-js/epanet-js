import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import noop from "lodash/noop";
import throttle from "lodash/throttle";

import type { HandlerContext } from "src/types";
import { Mode, cursorStyleAtom } from "src/state/jotai";
import { modeAtom } from "src/state/mode";
import { simulationResultsAtom } from "src/state/simulation";
import { useSelection } from "src/selection";
import { useClickedAsset } from "../utils";
import { searchNearbyRenderedFeatures } from "src/map/search";
import { clickableLayers } from "src/map/layers/layer";
import { notify } from "src/components/notifications";
import { Asset, LinkAsset, Pipe, Valve } from "src/hydraulic-model/asset-types";
import { Topology } from "src/hydraulic-model/topology";
import { runTrace } from "src/lib/trace";

const TRACE_MODE_MAP = {
  [Mode.BOUNDARY_TRACE_SELECT]: "boundary",
  [Mode.UPSTREAM_TRACE_SELECT]: "upstream",
  [Mode.DOWNSTREAM_TRACE_SELECT]: "downstream",
} as const;

type TraceModeKey = keyof typeof TRACE_MODE_MAP;

export function useTraceSelectHandlers({
  mode: modeWithOptions,
  selection,
  hydraulicModel,
  map,
}: HandlerContext): Handlers {
  const traceMode = TRACE_MODE_MAP[modeWithOptions.mode as TraceModeKey];

  const { getClickedAsset } = useClickedAsset(map, hydraulicModel.assets);
  const resultsReader = useAtomValue(simulationResultsAtom);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const { selectAsset, selectAssets, clearSelection } = useSelection(selection);

  const abortControllerRef = useRef<AbortController | null>(null);

  const abortPending = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  };

  const handleClick = async (
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ) => {
    e.preventDefault();
    abortPending();

    const clickedAsset = getClickedAsset(e);
    if (!clickedAsset) {
      clearSelection();
      return;
    }

    if (isForbiddenTarget(clickedAsset, traceMode, hydraulicModel.topology)) {
      return;
    }

    // For upstream/downstream, require simulation results
    if (traceMode !== "boundary" && !resultsReader) {
      notify({
        variant: "warning",
        title: "Simulation required",
        description: `Run a simulation first to use ${traceMode} trace.`,
      });
      selectAsset(clickedAsset.id);
      return;
    }

    // If clicked asset is a boundary type, just select it (no trace)
    if (isBoundaryAsset(clickedAsset)) {
      selectAsset(clickedAsset.id);
      return;
    }

    // Determine start nodes and links based on what was clicked
    const startNodeIds: number[] = [];
    const startLinkIds: number[] = [];

    if (clickedAsset.isLink) {
      startLinkIds.push(clickedAsset.id);
      const [startNode, endNode] = (clickedAsset as LinkAsset).connections;
      startNodeIds.push(startNode, endNode);
    } else {
      startNodeIds.push(clickedAsset.id);
    }

    selectAsset(clickedAsset.id);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const assetIds = await runTrace(
        hydraulicModel,
        resultsReader,
        {
          mode: traceMode,
          startNodeIds,
          startLinkIds,
        },
        abortController.signal,
      );

      if (abortController.signal.aborted) return;

      if (assetIds.length > 0) {
        selectAssets(assetIds);
      } else {
        selectAsset(clickedAsset.id);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      throw err;
    }
  };

  const handleMove = throttle(
    (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
      if (!map) return;

      const features = searchNearbyRenderedFeatures(map, {
        point: e.point,
        distance: 7,
        layers: clickableLayers,
      });

      const visibleFeatures = features.filter(
        (f) => !f.state || !f.state.hidden,
      );

      if (visibleFeatures.length === 0) {
        setCursor("");
        return;
      }

      const hoveredAsset = getClickedAsset(e);
      if (
        hoveredAsset &&
        isForbiddenTarget(hoveredAsset, traceMode, hydraulicModel.topology)
      ) {
        setCursor("not-allowed");
      } else {
        setCursor("pointer");
      }
    },
    16,
    { trailing: false },
  );

  return {
    click: handleClick,
    move: handleMove,
    down: noop,
    up: noop,
    double: noop,
    exit: () => {
      abortPending();
      setMode({ mode: Mode.NONE });
    },
  };
}

type TraceMode = (typeof TRACE_MODE_MAP)[TraceModeKey];

function isForbiddenTarget(
  asset: Asset,
  traceMode: TraceMode,
  topology: Topology,
): boolean {
  switch (traceMode) {
    case "boundary":
      return isBoundaryAsset(asset);
    case "upstream":
      return asset.type === "reservoir" || asset.type === "tank";
    case "downstream":
      return (
        asset.type === "junction" && topology.getLinks(asset.id).length <= 1
      );
  }
}

function isBoundaryAsset(asset: Asset): boolean {
  switch (asset.type) {
    case "tank":
    case "reservoir":
    case "pump":
      return true;
    case "valve": {
      const valve = asset as Valve;
      // TCV is only a boundary when closed
      if (valve.kind === "tcv") {
        return valve.initialStatus === "closed";
      }
      return true;
    }
    case "pipe": {
      const pipe = asset as Pipe;
      return pipe.initialStatus === "closed" || pipe.initialStatus === "cv";
    }
    default:
      return false;
  }
}
