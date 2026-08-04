import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  buildRoughnessInferrer,
  type RoughnessInferrer,
} from "src/hydraulic-model/pipe-materials";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

export const useRoughnessInferrer = (): RoughnessInferrer => {
  const isInferRoughnessOn = useFeatureFlag("FLAG_INFER_ROUGHNESS");
  const { pipeMaterials } = useAtomValue(stagingModelDerivedAtom);

  return useMemo(
    () =>
      buildRoughnessInferrer(pipeMaterials, { enabled: isInferRoughnessOn }),
    [pipeMaterials, isInferRoughnessOn],
  );
};
