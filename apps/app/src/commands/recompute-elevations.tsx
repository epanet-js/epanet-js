import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import throttle from "lodash/throttle";
import { AssetId, NodeAsset, isNodeAsset } from "@epanet-js/hydraulic-model";
import {
  getElevationEngine,
  type ElevationFetchStatus,
} from "src/lib/elevations";
import { createTimeSlicer } from "src/infra/yield-to-main";
import { captureError } from "src/infra/error-tracking";
import { notify } from "src/components/notifications";
import { SuccessIcon } from "src/icons";
import { TranslateFn, useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import { dialogAtom } from "src/state/dialog";
import { offlineAtom } from "src/state/offline";
import { projectSettingsAtom } from "src/state/project-settings";
import type { AssetPatch } from "src/hydraulic-model/model-operation";

export type RecomputeElevationsMode = "missing" | "all";

const NOTIFY_ID = "elevations-recompute-summary";

export type ElevationTargets = {
  missingIds: AssetId[];
  allIds: AssetId[];
};

// Scans the model for junction/tank ids that can receive an elevation. Runs only
// while `enabled` (the dialog is open) and yields to the main thread between
// chunks so a large model does not freeze the UI. Returns null while scanning.
export const useElevationTargets = (
  enabled: boolean,
): ElevationTargets | null => {
  const model = useAtomValue(stagingModelDerivedAtom);
  const [targets, setTargets] = useState<ElevationTargets | null>(null);

  useEffect(() => {
    if (!enabled) {
      setTargets(null);
      return;
    }

    let aborted = false;
    setTargets(null);

    void (async () => {
      const yieldIfSliceElapsed = createTimeSlicer();
      const missingIds: AssetId[] = [];
      const allIds: AssetId[] = [];
      for (const asset of model.assets.values()) {
        await yieldIfSliceElapsed();
        if (aborted) return;
        if (asset.type !== "junction" && asset.type !== "tank") continue;
        allIds.push(asset.id);
        if (asset.elevation === null) missingIds.push(asset.id);
      }
      if (!aborted) setTargets({ missingIds, allIds });
    })();

    return () => {
      aborted = true;
    };
  }, [enabled, model]);

  return targets;
};

export const useRecomputeElevations = () => {
  const model = useAtomValue(stagingModelDerivedAtom);
  const sources = useAtomValue(elevationSourcesAtom);
  const isOffline = useAtomValue(offlineAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const { transact } = useMomentTransaction();
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const setDialog = useSetAtom(dialogAtom);

  const recompute = useCallback(
    async ({
      assetIds,
      mode,
    }: {
      assetIds: AssetId[];
      mode: RecomputeElevationsMode;
    }) => {
      const availableSources = isOffline
        ? sources.filter((source) => source.type !== "tile-server")
        : sources;
      if (!availableSources.some((source) => source.enabled)) {
        setDialog({
          type: "recomputeElevationsProgress",
          summary: {
            reason: "noSources",
            total: 0,
            resolved: 0,
            unresolved: 0,
          },
        });
        return;
      }

      // A blocking progress dialog both signals work and prevents re-entry.
      // Stopping aborts the fetch and keeps whatever was resolved so far.
      const abortController = new AbortController();
      const onStop = () => abortController.abort();
      setDialog({ type: "recomputeElevationsProgress", onStop });

      // Progress + status fire per tile/bucket (potentially thousands). Keep the
      // latest of each and throttle the dialog updates into one flush.
      let latestResolved = 0;
      let latestTotal = 0;
      let latestStatus: ElevationFetchStatus | undefined;
      const flushProgress = throttle(() => {
        setDialog({
          type: "recomputeElevationsProgress",
          resolved: latestResolved,
          total: latestTotal,
          status: latestStatus,
          onStop,
        });
      }, 150);
      let targetCount = 0;
      try {
        const nodes: NodeAsset[] = [];
        const points: { lng: number; lat: number }[] = [];
        for (const assetId of assetIds) {
          const asset = model.assets.get(assetId);
          if (!asset || !isNodeAsset(asset)) continue;
          nodes.push(asset);
          const [lng, lat] = asset.coordinates;
          points.push({ lng, lat });
        }
        targetCount = nodes.length;

        // A source failure keeps whatever resolved first (like stopping); the
        // fetch resolves with partial results instead of throwing.
        let fetchFailed = false;
        const elevations = await getElevationEngine().fetchElevations(
          availableSources,
          points,
          units.elevation,
          {
            onProgress: (resolved, total) => {
              latestResolved = resolved;
              latestTotal = total;
              flushProgress();
            },
            onStatus: (status) => {
              latestStatus = status;
              flushProgress();
            },
            signal: abortController.signal,
            onError: (error) => {
              fetchFailed = true;
              captureError(
                error instanceof Error ? error : new Error(String(error)),
              );
            },
          },
        );
        flushProgress.cancel();

        const yieldIfSliceElapsed = createTimeSlicer();
        const patches: AssetPatch[] = [];
        let unresolved = 0;
        for (let i = 0; i < nodes.length; i++) {
          await yieldIfSliceElapsed();
          const elevation = elevations[i];
          if (elevation === null) {
            unresolved++;
            continue;
          }
          const node = nodes[i];
          patches.push({
            id: node.id,
            type: node.type,
            properties: { elevation },
          } as AssetPatch);
        }

        const resolved = patches.length;
        if (resolved > 0) {
          transact({
            note: "Recompute elevations",
            patchAssetsAttributes: patches,
          });
        }

        userTracking.capture({
          name: "elevations.recomputed",
          mode,
          resolved,
          unresolved,
        });

        // Resolved values are applied above regardless of how the run ended.
        // Fully resolved without interruption closes and confirms; a failure,
        // stop, or uncovered remainder keeps the dialog open to explain.
        const stopped = abortController.signal.aborted;
        if (!fetchFailed && !stopped && unresolved === 0) {
          setDialog(null);
          notifyAllResolved(translate, resolved);
        } else {
          setDialog({
            type: "recomputeElevationsProgress",
            summary: {
              reason: fetchFailed ? "error" : stopped ? "stopped" : "completed",
              total: nodes.length,
              resolved,
              unresolved,
            },
          });
        }
      } catch (error) {
        flushProgress.cancel();
        captureError(error instanceof Error ? error : new Error(String(error)));
        // Keep the dialog open, switched to its error layout.
        setDialog({
          type: "recomputeElevationsProgress",
          summary: {
            reason: "error",
            total: targetCount,
            resolved: latestResolved,
            unresolved: targetCount - latestResolved,
          },
        });
      }
    },
    [
      model,
      sources,
      isOffline,
      units.elevation,
      transact,
      userTracking,
      translate,
      setDialog,
    ],
  );

  return { recompute };
};

const notifyAllResolved = (translate: TranslateFn, resolved: number) =>
  notify({
    variant: "success",
    Icon: SuccessIcon,
    title: translate("elevations.recompute.summaryTitle"),
    description: translate(
      "elevations.recompute.summaryAllResolved",
      String(resolved),
    ),
    id: NOTIFY_ID,
  });
