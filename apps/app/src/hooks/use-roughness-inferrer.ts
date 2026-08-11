import { useAtomValue } from "jotai";
import { useMemo } from "react";
import {
  buildRoughnessInferrer,
  type RoughnessInferrer,
} from "src/hydraulic-model/pipe-materials";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

export const useRoughnessInferrer = (): RoughnessInferrer => {
  const { pipeMaterials } = useAtomValue(stagingModelDerivedAtom);

  return useMemo(() => buildRoughnessInferrer(pipeMaterials), [pipeMaterials]);
};
