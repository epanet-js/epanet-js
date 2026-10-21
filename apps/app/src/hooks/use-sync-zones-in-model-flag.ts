import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { isZonesInModelOnAtom } from "src/state/zones";

export const useSyncZonesInModelFlag = () => {
  const isZonesInModelOn = useFeatureFlag("FLAG_ZONES_IN_MODEL");
  const setIsZonesInModelOn = useSetAtom(isZonesInModelOnAtom);

  useEffect(() => {
    setIsZonesInModelOn(isZonesInModelOn);
  }, [isZonesInModelOn, setIsZonesInModelOn]);
};
