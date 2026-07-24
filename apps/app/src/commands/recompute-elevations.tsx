import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { AssetId, NodeAsset, isNodeAsset } from "@epanet-js/hydraulic-model";
import { fetchElevationsFromSources } from "src/lib/elevations";
import { createTimeSlicer } from "src/infra/yield-to-main";
import { notify } from "src/components/notifications";
import { captureError } from "src/infra/error-tracking";
import { SuccessIcon, UnavailableIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import { offlineAtom } from "src/state/offline";
import { projectSettingsAtom } from "src/state/project-settings";
import type { AssetPatch } from "src/hydraulic-model/model-operation";

export type RecomputeElevationsMode = "missing" | "all";

export type ElevationTargets = {
  missingIds: AssetId[];
  allIds: AssetId[];
};

// Scans the model for junction/tank ids that can receive an elevation. Runs only
// while `enabled` (the popover is open) and yields to the main thread between
// chunks so a large model does not freeze the panel. Returns null while scanning.
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
  const [isRunning, setIsRunning] = useState(false);

  const recompute = useCallback(
    async ({
      assetIds,
      mode,
    }: {
      assetIds: AssetId[];
      mode: RecomputeElevationsMode;
    }) => {
      if (assetIds.length === 0) return;

      const availableSources = isOffline
        ? sources.filter((source) => source.type !== "tile-server")
        : sources;
      if (!availableSources.some((source) => source.enabled)) {
        notify({
          variant: "warning",
          Icon: UnavailableIcon,
          title: translate("elevations.recompute.noSourcesTitle"),
          description: translate("elevations.recompute.noSources"),
          id: "elevations-recompute-summary",
        });
        return;
      }

      setIsRunning(true);
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

        // Overwrite mode clears every target first
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

        if (resolved === 0) {
          notify({
            variant: "warning",
            Icon: UnavailableIcon,
            title: translate("elevations.recompute.noneResolvedTitle"),
            description: translate(
              "elevations.recompute.noneResolved",
              String(nodes.length),
            ),
            id: "elevations-recompute-summary",
          });
        } else {
          notify({
            variant: "success",
            Icon: SuccessIcon,
            title: translate("elevations.recompute.summaryTitle"),
            description:
              unresolved > 0
                ? translate(
                    "elevations.recompute.summary",
                    String(resolved),
                    String(unresolved),
                  )
                : translate(
                    "elevations.recompute.summaryAllResolved",
                    String(resolved),
                  ),
            id: "elevations-recompute-summary",
          });
        }
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        notify({
          variant: "error",
          Icon: UnavailableIcon,
          title: translate("elevations.recompute.failedTitle"),
          description: translate("elevations.recompute.failed"),
          id: "elevations-recompute-summary",
        });
      } finally {
        setIsRunning(false);
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
    ],
  );

  return { recompute, isRunning };
};
