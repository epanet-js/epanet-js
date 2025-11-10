import { useSetAtom } from "jotai";
import { USelection } from "./selection";
import { Sel, TabOption, selectionAtom, tabAtom } from "src/state/jotai";
import { Asset, AssetId } from "src/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";

export const useSelection = (selection: Sel) => {
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);
  const userTracking = useUserTracking();

  const toggleSingleSelection = (id: AssetId, _type: Asset["type"]) => {
    setSelection(USelection.toggleSingleSelectionId(selection, id));
    setTab(TabOption.Asset);
  };

  const extendSelection = (assetId: AssetId | AssetId[]) => {
    const newSelection = Array.isArray(assetId)
      ? USelection.addSelectionIds(selection, assetId)
      : USelection.addSelectionId(selection, assetId);

    const newCount = USelection.toIds(newSelection).length;
    userTracking.capture({
      name: "multiSelect.updated",
      count: newCount,
    });
    setSelection(newSelection);
    setTab(TabOption.Asset);
  };

  const isSelected = (assetId: AssetId) => {
    return USelection.isSelected(selection, assetId);
  };

  const selectAsset = (assetId: AssetId) => {
    setSelection(USelection.single(assetId));
    setTab(TabOption.Asset);
  };

  const selectAssets = (assetIds: AssetId[]) => {
    setSelection(USelection.fromIds(assetIds));
    setTab(TabOption.Asset);
  };

  const selectCustomerPoint = (customerPointId: number) => {
    setSelection(USelection.singleCustomerPoint(customerPointId));
    setTab(TabOption.Asset);
  };

  const removeFromSelection = (assetId: AssetId | AssetId[]) => {
    const newSelection = Array.isArray(assetId)
      ? USelection.removeSelectionIds(selection, assetId)
      : USelection.removeFeatureFromSelection(selection, assetId);

    const newCount = USelection.toIds(newSelection).length;
    userTracking.capture({
      name: "multiSelect.updated",
      count: newCount,
    });
    setSelection(newSelection);
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
    selectAsset,
    selectAssets,
    selectCustomerPoint,
    getSelectionIds,
  };
};
