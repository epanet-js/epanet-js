import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useElevations } from "src/hooks/use-elevations";
import { addNode } from "src/hydraulic-model/model-operations";
import { useUserTracking } from "src/infra/user-tracking";
import { CrossingPipe } from "src/lib/network-review";
import { modelFactoriesAtom } from "src/state/model-factories";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";

export const useFixCrossingPipes = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const { assetFactory, labelManager } = useAtomValue(modelFactoriesAtom);
  const { fetchElevation } = useElevations(units.elevation);
  const userTracking = useUserTracking();
  const isEditionBlocked = useIsEditionBlocked();
  const { transact } = useMomentTransaction();

  const fix = useCallback(
    (crossing: CrossingPipe) => {
      if (isEditionBlocked) return;

      const [lng, lat] = crossing.intersectionPoint;

      // The junction would otherwise default to elevation 0 and immediately
      // fail the elevation attribute check.
      void fetchElevation({ lng, lat })
        .catch(() => null)
        .then((elevation) => {
          transact(
            addNode(hydraulicModel, {
              nodeType: "junction",
              coordinates: crossing.intersectionPoint,
              elevation,
              pipeIdsToSplit: [crossing.pipe1Id, crossing.pipe2Id],
              lengthUnit: units.length,
              assetFactory,
              labelManager,
            }),
          );

          userTracking.capture({
            name: "networkReview.crossingPipes.fixed",
            pipeIds: [crossing.pipe1Id, crossing.pipe2Id],
          });
        });
    },
    [
      hydraulicModel,
      units.length,
      assetFactory,
      labelManager,
      fetchElevation,
      transact,
      userTracking,
      isEditionBlocked,
    ],
  );

  return { fix };
};
