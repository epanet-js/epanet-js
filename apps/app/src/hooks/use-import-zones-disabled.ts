import { useAtomValue } from "jotai";
import { isUnprojectedAtom } from "src/state/map-projection";

export const useImportZonesDisabled = () => {
  const isUnprojected = useAtomValue(isUnprojectedAtom);

  return isUnprojected;
};
