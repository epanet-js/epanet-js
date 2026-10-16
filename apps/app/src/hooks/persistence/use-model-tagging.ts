import { useMemo } from "react";
import { createFileTagger, type FileTagger } from "@epanet-js/ejsdb-tag";
import type { Plan } from "@epanet-js/account-plans";
import { useEffectivePlan } from "src/hooks/use-effective-plan";

export type ModelTagging = {
  plan: Plan;
  tagger: FileTagger;
};

export const useModelTagging = (): ModelTagging => {
  const plan = useEffectivePlan();
  return useMemo(() => ({ plan, tagger: createFileTagger(plan) }), [plan]);
};
