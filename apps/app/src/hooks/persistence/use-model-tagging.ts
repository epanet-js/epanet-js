import { useMemo } from "react";
import {
  createFileTagger,
  nullFileTagger,
  type FileTagger,
} from "@epanet-js/ejsdb-tag";
import type { Plan } from "@epanet-js/account-plans";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useEffectivePlan } from "src/hooks/use-effective-plan";

export type ModelTagging = {
  isTagModelsOn: boolean;
  plan: Plan;
  tagger: FileTagger;
};

export const useModelTagging = (): ModelTagging => {
  const isTagModelsOn = useFeatureFlag("FLAG_TAG_MODELS");
  const plan = useEffectivePlan();
  return useMemo(
    () => ({
      isTagModelsOn,
      plan,
      tagger: isTagModelsOn ? createFileTagger(plan) : nullFileTagger,
    }),
    [isTagModelsOn, plan],
  );
};
