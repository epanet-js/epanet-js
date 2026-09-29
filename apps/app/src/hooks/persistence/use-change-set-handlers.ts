import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  applyChange,
  applyChangeDeprecated,
  type ApplyChange,
} from "src/lib/persistence/transaction-helpers";
import {
  persistBranchChange,
  persistBranchChangeDeprecated,
  type PersistBranchChange,
} from "src/lib/persistence/persist-branch-change";

export type ChangeSetHandlers = {
  apply: ApplyChange;
  persist: PersistBranchChange;
};

const handlers: ChangeSetHandlers = {
  apply: applyChange,
  persist: persistBranchChange,
};

const handlersDeprecated: ChangeSetHandlers = {
  apply: applyChangeDeprecated,
  persist: persistBranchChangeDeprecated,
};

export const useChangeSetHandlers = (): ChangeSetHandlers => {
  const isLazyScenariosOn = useFeatureFlag("FLAG_LAZY_SCENARIOS");
  return isLazyScenariosOn ? handlers : handlersDeprecated;
};
