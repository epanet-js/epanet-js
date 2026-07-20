import type { HandlerContext } from "src/types";
import { ephemeralStateAtom } from "src/state/drawing";
import { cursorStyleAtom } from "src/state/map";
import { modeAtom, Mode } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import noop from "lodash/noop";
import { useSetAtom, useAtom, useAtomValue } from "jotai";
import { useRef } from "react";
import { getMapCoord } from "../utils";
import { addNode, replaceNode } from "src/hydraulic-model/model-operations";
import { modelFactoriesAtom } from "src/state/model-factories";
import throttle from "lodash/throttle";
import { useUserTracking } from "src/infra/user-tracking";
import { useElevations } from "../../elevations/use-elevations";
import { useSnapping } from "../hooks/use-snapping";
import { useSelection } from "src/selection";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useFocusAssetPanel } from "src/hooks/use-focus-asset-panel";
import { validateAsset } from "src/lib/model-attributes-validation";
import { Asset } from "src/hydraulic-model";

type NodeType = "junction" | "reservoir" | "tank";

export function useDrawNodeHandlers({
  hydraulicModel,
  nodeType,
  map,
  units,
  readonly = false,
}: HandlerContext & { nodeType: NodeType }): Handlers {
  const isUpdatingRef = useRef(false);
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const selection = useAtomValue(selectionAtom);
  const { transact } = useMomentTransaction();
  const userTracking = useUserTracking();
  const { assetFactory, labelManager } = useAtomValue(modelFactoriesAtom);
  const { fetchElevation, prefetchTileThrottled } = useElevations(
    units.elevation,
  );
  const { findSnappingCandidate } = useSnapping(map, hydraulicModel.assets);
  const { selectAsset } = useSelection(selection);
  const focusAssetPanel = useFocusAssetPanel();

  const selectAndFocusIfInvalid = (asset: Asset) => {
    selectAsset(asset.id);
    const hasIssues = validateAsset(asset, hydraulicModel).length > 0;
    if (hasIssues) focusAssetPanel(true);
  };

  const submitNode = (
    nodeType: NodeType,
    coordinates: [number, number],
    elevation: number,
    pipeIdToSplit?: number,
  ) => {
    const moment = addNode(hydraulicModel, {
      nodeType,
      coordinates,
      elevation,
      pipeIdToSplit,
      lengthUnit: units.length,
      assetFactory,
      labelManager,
    });
    const applied = transact(moment);
    if (!applied) return;

    userTracking.capture({ name: "asset.created", type: nodeType });

    if (moment.putAssets && moment.putAssets.length > 0) {
      selectAndFocusIfInvalid(moment.putAssets[0]);
    }
  };

  const submitNodeReplacement = (oldNodeId: number, elevation: number) => {
    const moment = replaceNode(hydraulicModel, {
      oldNodeId,
      newNodeType: nodeType,
      assetFactory,
      elevation,
    });
    const applied = transact(moment);
    if (applied) {
      userTracking.capture({
        name: "asset.created",
        type: nodeType,
      });

      if (moment.putAssets && moment.putAssets.length > 0) {
        selectAndFocusIfInvalid(moment.putAssets[0]);
      }
    }

    setEphemeralState({ type: "none" });
  };

  const startElevationFetch = () => {
    isUpdatingRef.current = true;
    setCursor("wait");
  };

  const finishElevationFetch = () => {
    isUpdatingRef.current = false;
    setCursor("default");
  };

  const handleClick: Handlers["click"] = (e) => {
    if (readonly) return;
    if (isUpdatingRef.current) return;

    const mouseCoord = getMapCoord(e);
    const snappingCandidate = findSnappingCandidate(e, mouseCoord);

    if (snappingCandidate && snappingCandidate.type !== "pipe") {
      const knownElevation = snappingCandidate.elevation;
      if (knownElevation !== null) {
        submitNodeReplacement(snappingCandidate.id, knownElevation);
        return;
      }

      const [lng, lat] = snappingCandidate.coordinates;
      startElevationFetch();
      void fetchElevation({ lng, lat } as mapboxgl.LngLat)
        .then((elevation) =>
          submitNodeReplacement(snappingCandidate.id, elevation),
        )
        .finally(finishElevationFetch);
      return;
    }

    const isPipeSplitting =
      ephemeralState.type === "drawNode" &&
      !!ephemeralState.pipeSnappingPosition;
    const clickPosition = isPipeSplitting
      ? (ephemeralState.pipeSnappingPosition as [number, number])
      : mouseCoord;
    const pipeIdToSplit = isPipeSplitting
      ? (ephemeralState.pipeId ?? undefined)
      : undefined;
    const lngLatForElevation = isPipeSplitting
      ? ({ lng: clickPosition[0], lat: clickPosition[1] } as mapboxgl.LngLat)
      : e.lngLat;

    startElevationFetch();
    void fetchElevation(lngLatForElevation)
      .then((elevation) => {
        submitNode(nodeType, clickPosition, elevation, pipeIdToSplit);
        setEphemeralState({ type: "none" });
      })
      .finally(finishElevationFetch);
  };

  return {
    click: handleClick,
    move: throttle(
      (e) => {
        prefetchTileThrottled(e.lngLat);

        if (isUpdatingRef.current) return;

        const mouseCoord = getMapCoord(e);
        const snappingCandidate = findSnappingCandidate(e, mouseCoord);

        const isNodeSnapping =
          snappingCandidate && snappingCandidate.type !== "pipe";
        const isPipeSnapping =
          snappingCandidate && snappingCandidate.type === "pipe";

        if (isNodeSnapping) {
          setCursor("replace");
        } else {
          setCursor("default");
        }

        setEphemeralState({
          type: "drawNode",
          nodeType,
          pipeSnappingPosition: isPipeSnapping
            ? snappingCandidate.coordinates
            : null,
          pipeId: isPipeSnapping ? snappingCandidate.id : null,
          nodeSnappingId: isNodeSnapping ? snappingCandidate.id : null,
          nodeReplacementId: isNodeSnapping ? snappingCandidate.id : null,
        });
      },
      200,
      { trailing: false },
    ),
    down: noop,
    up: noop,
    double: noop,
    exit() {
      setMode({ mode: Mode.NONE });
      setEphemeralState({ type: "none" });
      setCursor("default");
    },
  };
}
