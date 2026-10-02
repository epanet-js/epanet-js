import type { HandlerContext } from "src/types";
import { ephemeralStateAtom } from "src/state/drawing";
import { cursorStyleAtom } from "src/state/map";
import { modeAtom, Mode } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import noop from "lodash/noop";
import { useSetAtom, useAtomValue } from "jotai";
import { useCallback, useRef } from "react";
import { useAtomCallback } from "jotai/utils";
import type { ChangeSet } from "@epanet-js/change-set";
import { getMapCoord } from "../utils";
import {
  addNode,
  addNodeDeprecated,
  replaceNode,
  replaceNodeDeprecated,
} from "src/hydraulic-model/model-operations";
import { modelFactoriesAtom } from "src/state/model-factories";
import throttle from "lodash/throttle";
import { useUserTracking } from "src/infra/user-tracking";
import { useElevations } from "src/hooks/use-elevations";
import { useSnapping } from "../hooks/use-snapping";
import { useSelection } from "src/selection";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useFocusAssetPanel } from "src/hooks/use-focus-asset-panel";
import { validateAsset } from "src/lib/model-attributes-validation";
import { Asset, AssetId, HydraulicModel } from "src/hydraulic-model";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { captureWarning } from "src/infra/error-tracking";

type NodeType = "junction" | "reservoir" | "tank";

const createdNodeId = (changeSet: ChangeSet): AssetId | undefined => {
  for (const entry of changeSet.entries()) {
    if (
      entry.kind === "create" &&
      (entry.entity === "junction" ||
        entry.entity === "reservoir" ||
        entry.entity === "tank")
    ) {
      return entry.id as AssetId;
    }
  }
  return undefined;
};

export function useDrawNodeHandlers({
  hydraulicModel,
  nodeType,
  map,
  units,
  readonly = false,
}: HandlerContext & { nodeType: NodeType }): Handlers {
  const isUpdatingRef = useRef(false);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const selection = useAtomValue(selectionAtom);
  const { transact } = useMomentTransaction();
  const { transact: transactChangeSet } = useModelTransaction();
  const isOpsChangeSetsOn = useFeatureFlag("FLAG_OPS_CHANGE_SETS");
  const readCommittedModel = useAtomCallback(
    useCallback((get) => get(stagingModelDerivedAtom), []),
  );
  const userTracking = useUserTracking();
  const { assetFactory, labelManager } = useAtomValue(modelFactoriesAtom);
  const { fetchElevation, prefetchTileThrottled } = useElevations(
    units.elevation,
  );
  const { findSnappingCandidate } = useSnapping(map, hydraulicModel.assets);
  const { selectAsset } = useSelection(selection);
  const focusAssetPanel = useFocusAssetPanel();

  const selectAndFocusIfInvalid = (
    asset: Asset,
    model: HydraulicModel = hydraulicModel,
  ) => {
    selectAsset(asset.id);
    const hasIssues = validateAsset(asset, model).length > 0;
    if (hasIssues) focusAssetPanel(true);
  };

  const submitNode = (
    nodeType: NodeType,
    coordinates: [number, number],
    elevation: number | null,
    pipeIdToSplit?: number,
  ) => {
    if (
      pipeIdToSplit !== undefined &&
      hydraulicModel.assets.get(pipeIdToSplit)?.type !== "pipe"
    ) {
      captureWarning("Pipe to split is no longer in the model");
      return;
    }

    const data = {
      nodeType,
      coordinates,
      elevation,
      pipeIdsToSplit: pipeIdToSplit !== undefined ? [pipeIdToSplit] : undefined,
      lengthUnit: units.length,
      assetFactory,
      labelManager,
    };

    if (isOpsChangeSetsOn) {
      const changeSet = addNode(hydraulicModel, data);
      const applied = transactChangeSet(changeSet);
      if (!applied) return;

      userTracking.capture({ name: "asset.created", type: nodeType });

      const newNodeId = createdNodeId(changeSet);
      const committedModel = readCommittedModel();
      const newNode =
        newNodeId !== undefined
          ? committedModel.assets.get(newNodeId)
          : undefined;
      if (newNode) selectAndFocusIfInvalid(newNode, committedModel);
    } else {
      const moment = addNodeDeprecated(hydraulicModel, data);
      const applied = transact(moment);
      if (!applied) return;

      userTracking.capture({ name: "asset.created", type: nodeType });

      if (moment.putAssets && moment.putAssets.length > 0) {
        selectAndFocusIfInvalid(moment.putAssets[0]);
      }
    }
  };

  const submitNodeReplacement = (
    oldNodeId: number,
    elevation: number | null,
  ) => {
    const data = {
      oldNodeId,
      newNodeType: nodeType,
      assetFactory,
      elevation,
    };

    if (isOpsChangeSetsOn) {
      const changeSet = replaceNode(hydraulicModel, data);
      const applied = transactChangeSet(changeSet);
      if (applied) {
        userTracking.capture({
          name: "asset.created",
          type: nodeType,
        });

        const newNodeId = createdNodeId(changeSet);
        const committedModel = readCommittedModel();
        const newNode =
          newNodeId !== undefined
            ? committedModel.assets.get(newNodeId)
            : undefined;
        if (newNode) selectAndFocusIfInvalid(newNode, committedModel);
      }
    } else {
      const moment = replaceNodeDeprecated(hydraulicModel, data);
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
      void fetchElevation({ lng, lat })
        .then((elevation) =>
          submitNodeReplacement(snappingCandidate.id, elevation),
        )
        .finally(finishElevationFetch);
      return;
    }

    const pipeToSplit = snappingCandidate;
    const clickPosition = pipeToSplit
      ? (pipeToSplit.coordinates as [number, number])
      : mouseCoord;
    const lngLatForElevation = pipeToSplit
      ? { lng: clickPosition[0], lat: clickPosition[1] }
      : e.lngLat;

    startElevationFetch();
    void fetchElevation(lngLatForElevation)
      .then((elevation) => {
        submitNode(nodeType, clickPosition, elevation, pipeToSplit?.id);
      })
      .finally(() => {
        setEphemeralState({ type: "none" });
        finishElevationFetch();
      });
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
