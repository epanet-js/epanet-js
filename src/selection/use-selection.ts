import { useSetAtom } from "jotai";
import { USelection } from "./selection";
import { Sel, TabOption, selectionAtom, tabAtom } from "src/state/jotai";
import { IWrappedFeature } from "src/types";
import { isFeatureOn } from "src/infra/feature-flags";

export const useSelection = (selection: Sel) => {
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);

  const toggleSingleSelection = (featureId: IWrappedFeature["id"]) => {
    setSelection(USelection.toggleSingleSelectionId(selection, featureId));
    isFeatureOn("FLAG_PRESSURES") && setTab(TabOption.Asset);
  };

  const extendSelection = (featureId: IWrappedFeature["id"]) => {
    setSelection(USelection.addSelectionId(selection, featureId));
    isFeatureOn("FLAG_PRESSURES") && setTab(TabOption.Asset);
  };

  const isSelected = (featureId: IWrappedFeature["id"]) => {
    return USelection.isSelected(selection, featureId);
  };

  const selectFeature = (featureId: IWrappedFeature["id"]) => {
    setSelection(USelection.single(featureId));
    isFeatureOn("FLAG_PRESSURES") && setTab(TabOption.Asset);
  };

  const removeFromSelection = (featureId: IWrappedFeature["id"]) => {
    setSelection(USelection.removeFeatureFromSelection(selection, featureId));
  };

  const clearSelection = () => {
    setSelection(USelection.none());
  };

  const getSelectionIds = () => USelection.toIds(selection);

  return {
    setSelection,
    clearSelection,
    toggleSingleSelection,
    extendSelection,
    isSelected,
    removeFromSelection,
    selectFeature,
    getSelectionIds,
  };
};
