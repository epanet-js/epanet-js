import { useSetAtom } from "jotai";
import { USelection } from "./selection";
import { Sel, TabOption, selectionAtom, tabAtom } from "src/state/jotai";
import { IWrappedFeature } from "src/types";
import { Asset, AssetId } from "src/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";

export const useSelection = (selection: Sel) => {
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);
  const userTracking = useUserTracking();

  const toggleSingleSelection = (id: AssetId, type: Asset["type"]) => {
    userTracking.capture({
      name:
        isSelected(id) && getSelectionIds().length === 1
          ? "asset.deselected"
          : "asset.selected",
      type,
    });
    setSelection(USelection.toggleSingleSelectionId(selection, id));
    setTab(TabOption.Asset);
  };

  const extendSelection = (featureId: IWrappedFeature["id"]) => {
    userTracking.capture({
      name: "multiSelect.updated",
      count: getSelectionIds().length + 1,
    });
    setSelection(USelection.addSelectionId(selection, featureId));
    setTab(TabOption.Asset);
  };

  const isSelected = (featureId: IWrappedFeature["id"]) => {
    return USelection.isSelected(selection, featureId);
  };

  const selectFeature = (featureId: IWrappedFeature["id"]) => {
    setSelection(USelection.single(featureId));
    setTab(TabOption.Asset);
  };

  const removeFromSelection = (featureId: IWrappedFeature["id"]) => {
    userTracking.capture({
      name: "multiSelect.updated",
      count: getSelectionIds().length - 1,
    });
    setSelection(USelection.removeFeatureFromSelection(selection, featureId));
  };

  const clearSelection = () => {
    if (getSelectionIds().length > 0) {
      userTracking.capture({
        name: "selection.cleared",
      });
    }
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
