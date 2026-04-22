import { useAtomValue } from "jotai";
import { useIsBranchLocked } from "src/hooks/use-is-branch-locked";
import { isPlayingAtom } from "src/state/simulation-playback";

export const useIsEditionBlocked = () => {
  const isBranchLocked = useIsBranchLocked();
  const isPlaying = useAtomValue(isPlayingAtom);
  return isBranchLocked || isPlaying;
};
