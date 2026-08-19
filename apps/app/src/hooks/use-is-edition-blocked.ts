import { useAtomValue } from "jotai";
import { useIsBranchLocked } from "src/hooks/use-is-branch-locked";
import { isPlayingAtom } from "src/state/simulation-playback";
import { historyPendingAtom } from "src/state/transactions";

export const useIsEditionBlocked = () => {
  const isBranchLocked = useIsBranchLocked();
  const isPlaying = useAtomValue(isPlayingAtom);
  const isHistoryPending = useAtomValue(historyPendingAtom);
  return isBranchLocked || isPlaying || isHistoryPending;
};
