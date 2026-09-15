import { useSetAtom } from "jotai";
import { USelection } from "./selection";
import type { Sel } from "./types";
import { useShowAssetPanel } from "src/commands/show-asset-panel";
import { selectionAtom } from "src/state/selection";
import { Asset, AssetId } from "src/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";

export const useSelection = (selection: Sel) => {
  const setSelection = useSetAtom(selectionAtom);
  const showAssetPanel = useShowAssetPanel();
  const userTracking = useUserTracking();

  const toggleSingleSelection = (id: AssetId, _type: Asset["type"]) => {
    setSelection(USelection.toggleSingleAsset(selection, id));
    showAssetPanel();
  };

  const extendSelection = (assetId: AssetId | AssetId[]) => {
    const newSelection = Array.isArray(assetId)
      ? USelection.addAssetIds(selection, assetId)
      : USelection.addId(selection, "asset", assetId);

    const newCount = USelection.getAssetIds(newSelection).length;
    userTracking.capture({
      name: "multiSelect.updated",
      count: newCount,
      operation: Array.isArray(assetId) ? "bulk_add" : "single_add",
    });
    setSelection(newSelection);
    showAssetPanel();
  };

  const isSelected = (assetId: AssetId) => {
    return USelection.isAssetSelected(selection, assetId);
  };

  const selectAsset = (assetId: AssetId) => {
    setSelection(USelection.singleAsset(assetId));
    showAssetPanel();
  };

  const selectAssets = (assetIds: AssetId[]) => {
    userTracking.capture({
      name: "multiSelect.updated",
      count: assetIds.length,
      operation: "new",
    });
    setSelection(USelection.fromAssetIds(assetIds));
    showAssetPanel();
  };

  const selectCustomerPoint = (customerPointId: number) => {
    setSelection(USelection.singleCustomerPoint(customerPointId));
    showAssetPanel();
  };

  const selectCustomerPoints = (customerPointIds: number[]) => {
    userTracking.capture({
      name: "multiSelect.updated",
      count: customerPointIds.length,
      operation: "new",
    });
    setSelection(USelection.fromIds([], customerPointIds));
    showAssetPanel();
  };

  const extendCustomerPointSelection = (customerPointId: number | number[]) => {
    const ids = Array.isArray(customerPointId)
      ? customerPointId
      : [customerPointId];
    let next = selection;
    for (const id of ids) next = USelection.addId(next, "customerPoint", id);
    const { assets, customerPoints } = USelection.countByKind(next);
    userTracking.capture({
      name: "multiSelect.updated",
      count: assets + customerPoints,
      operation: Array.isArray(customerPointId) ? "bulk_add" : "single_add",
    });
    setSelection(next);
    showAssetPanel();
  };

  const toggleCustomerPointSelection = (customerPointId: number) => {
    setSelection(
      USelection.toggleId(selection, "customerPoint", customerPointId),
    );
    showAssetPanel();
  };

  const removeCustomerPointFromSelection = (
    customerPointId: number | number[],
  ) => {
    const ids = Array.isArray(customerPointId)
      ? customerPointId
      : [customerPointId];
    let next = selection;
    for (const id of ids) next = USelection.removeId(next, "customerPoint", id);
    const { assets, customerPoints } = USelection.countByKind(next);
    userTracking.capture({
      name: "multiSelect.updated",
      count: assets + customerPoints,
      operation: Array.isArray(customerPointId)
        ? "bulk_remove"
        : "single_remove",
    });
    setSelection(next);
  };

  const isCustomerPointSelected = (customerPointId: number) =>
    USelection.isCustomerPointSelected(selection, customerPointId);

  const removeFromSelection = (assetId: AssetId | AssetId[]) => {
    const newSelection = Array.isArray(assetId)
      ? USelection.removeAssetIds(selection, assetId)
      : USelection.removeId(selection, "asset", assetId);

    const newCount = USelection.getAssetIds(newSelection).length;
    userTracking.capture({
      name: "multiSelect.updated",
      count: newCount,
      operation: Array.isArray(assetId) ? "bulk_remove" : "single_remove",
    });
    setSelection(newSelection);
  };

  const clearSelection = () => {
    setSelection(USelection.none());
  };

  const getSelectionIds = () => USelection.getAssetIds(selection);

  return {
    setSelection,
    clearSelection,
    selectAsset,
    selectAssets,
    extendSelection,
    toggleSingleSelection,
    removeFromSelection,
    selectCustomerPoint,
    isSelected,
    selectCustomerPoints,
    extendCustomerPointSelection,
    toggleCustomerPointSelection,
    removeCustomerPointFromSelection,
    isCustomerPointSelected,
    getSelectionIds,
  };
};
