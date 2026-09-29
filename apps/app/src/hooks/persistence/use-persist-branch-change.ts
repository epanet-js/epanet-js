import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  persistBranchChange,
  persistBranchChangeDeprecated,
  type PersistBranchChange,
} from "src/lib/persistence/persist-branch-change";

export const usePersistBranchChange = (): PersistBranchChange => {
  const isLazyScenariosOn = useFeatureFlag("FLAG_LAZY_SCENARIOS");
  return isLazyScenariosOn
    ? persistBranchChange
    : persistBranchChangeDeprecated;
};
