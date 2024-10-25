import { useSetAtom } from "jotai";
import { USelection } from "./selection";
import { Sel, selectionAtom } from "src/state/jotai";
import { IWrappedFeature } from "src/types";

export const useSelection = (selection: Sel) => {
  const setSelection = useSetAtom(selectionAtom);

  const toggleSingleSelection = (featureId: IWrappedFeature["id"]) => {
    setSelection(USelection.toggleSingleSelectionId(selection, featureId));
  };

  const extendSelection = (featureId: IWrappedFeature["id"]) => {
    setSelection(USelection.addSelectionId(selection, featureId));
  };

  const isSelected = (featureId: IWrappedFeature["id"]) => {
    return USelection.isSelected(selection, featureId);
  };

  const removeFromSelection = (featureId: IWrappedFeature["id"]) => {
    setSelection(USelection.removeFeatureFromSelection(selection, featureId));
  };

  const clearSelection = () => {
    setSelection(USelection.none());
  };

  return {
    setSelection,
    clearSelection,
    toggleSingleSelection,
    extendSelection,
    isSelected,
    removeFromSelection,
  };
};
