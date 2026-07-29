import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { AssetId, NodeAsset, isNodeAsset } from "@epanet-js/hydraulic-model";
import { fetchElevationsFromSources } from "src/lib/elevations";
import { createTimeSlicer } from "src/infra/yield-to-main";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import { offlineAtom } from "src/state/offline";
import { projectSettingsAtom } from "src/state/project-settings";
import type { AssetPatch } from "src/hydraulic-model/model-operation";

export type RecomputeElevationsMode = "missing" | "all";

export type RecomputeElevationsResult =
  | { status: "noSources" }
  | { status: "error" }
  | {
      status: "done";
      mode: RecomputeElevationsMode;
      total: number;
      resolved: number;
      unresolved: number;
    };

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

  const recompute = useCallback(
    async ({
      assetIds,
      mode,
    }: {
      assetIds: AssetId[];
      mode: RecomputeElevationsMode;
    }): Promise<RecomputeElevationsResult> => {
      const availableSources = isOffline
        ? sources.filter((source) => source.type !== "tile-server")
        : sources;
      if (!availableSources.some((source) => source.enabled)) {
        return { status: "noSources" };
      }

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

        // Overwrite mode clears every target first, as its own committed step, so
        // that if the fetch fails the user can see which nodes still have no value.
        // Unresolved nodes then simply stay empty (never refilled below).
        if (mode === "all") {
          const clearIfSliceElapsed = createTimeSlicer();
          const clearPatches: AssetPatch[] = [];
          for (let i = 0; i < nodes.length; i++) {
            await clearIfSliceElapsed();
            const node = nodes[i];
            clearPatches.push({
              id: node.id,
              type: node.type,
              properties: { elevation: null },
            } as AssetPatch);
          }
          if (clearPatches.length > 0) {
            transact({
              note: "Clear elevations",
              patchAssetsAttributes: clearPatches,
            });
          }
        }

        const elevations = await fetchElevationsFromSources(
          availableSources,
          points,
          units.elevation,
        );

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

        return {
          status: "done",
          mode,
          total: nodes.length,
          resolved,
          unresolved,
        };
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        return { status: "error" };
      }
    },
    [model, sources, isOffline, units.elevation, transact, userTracking],
  );

  return { recompute };
};
