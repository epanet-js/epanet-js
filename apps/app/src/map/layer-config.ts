import { useSetAtom } from "jotai";
import { applyLayerConfigChangesAtom } from "src/state/map";

export const useLayerConfigState = () => {
  const applyChanges = useSetAtom(applyLayerConfigChangesAtom);

  return {
    applyChanges,
  };
};
