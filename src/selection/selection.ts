import type {
  Sel,
  SelFolder,
  SelSingle,
  SelSingleCustomerPoint,
} from "src/state/jotai";
import type { FolderMap, IFolder, IWrappedFeature } from "src/types";
import type { HydraulicModel, AssetsMap } from "src/hydraulic-model";
import type { CustomerPoints } from "src/hydraulic-model/customer-points";
import { toggle } from "src/lib/utils";
import { EMPTY_ARRAY } from "src/lib/constants";
import { getFoldersInTree } from "src/lib/folder";

type SelectionData = {
  selection: Sel;
  hydraulicModel: HydraulicModel;
  folderMap: FolderMap;
};

export const USelection = {
  /**
   * Used when we transition from a "something is selected" mode to a
   * drawing mode. This preserves the parent folder selection so that
   * we can place a feature in that.
   */
  selectionToFolder(data: SelectionData): Sel {
    const { selection } = data;

    switch (selection.type) {
      case "none":
        return SELECTION_NONE;
      case "folder":
        return selection;
      case "singleCustomerPoint":
        return SELECTION_NONE;
      case "multi":
      case "single": {
        const wrappedFeature = USelection.getSelectedFeatures(data)[0];

        return wrappedFeature?.folderId
          ? USelection.folder(wrappedFeature.folderId)
          : SELECTION_NONE;
      }
    }
  },
  reduce(selection: Sel): Sel {
    return selection.type === "single" && selection.parts.length
      ? USelection.single(selection.id)
      : USelection.none();
  },
  /**
   * Return **Feature** ids associated with this selection.
   * Folder selections return an empty list.
   */
  toIds(selection: Sel): readonly IWrappedFeature["id"][] {
    switch (selection.type) {
      case "none":
      case "folder":
      case "singleCustomerPoint":
        return [];
      case "single":
        return [selection.id];
      case "multi":
        return selection.ids;
    }
  },
  /**
   * Get vertices as an array if they are in the selection.
   */

  getVertexIds(selection: Sel): VertexId[] {
    if (selection.type === "single" && selection.parts.length) {
      return selection.parts.flatMap((id) => {
        return id.type === "vertex" ? [id] : [];
      });
    }
    return EMPTY_ARRAY as VertexId[];
  },

  // Dangerous: this will throw if given a 'none' selection.
  // Basically an assertion method.
  asSingle(selection: Sel): SelSingle {
    if (
      selection.type === "none" ||
      selection.type === "folder" ||
      selection.type === "singleCustomerPoint"
    ) {
      throw new Error("Given a none selection");
    }
    return selection.type === "single"
      ? selection
      : {
          type: "single",
          id: selection.ids[0],
          parts: [],
        };
  },
  fromIds(ids: IWrappedFeature["id"][]): Sel {
    return ids.length === 0
      ? { type: "none" }
      : ids.length === 1
        ? this.single(ids[0])
        : {
            type: "multi",
            ids,
          };
  },
  /**
   * Get selected features of a single or multi selection.
   */
  getSelectedFeatures({
    selection,
    hydraulicModel,
    folderMap,
  }: SelectionData): IWrappedFeature[] {
    switch (selection.type) {
      case "none": {
        return EMPTY_ARRAY as IWrappedFeature[];
      }
      case "folder": {
        const folders = getFoldersInTree(folderMap, selection.id);
        const features: IWrappedFeature[] = [];
        for (const feature of hydraulicModel.assets.values()) {
          if (feature.folderId && folders.has(feature.folderId)) {
            features.push(feature);
          }
        }
        return features;
      }
      default: {
        const features: IWrappedFeature[] = [];
        for (const id of this.toIds(selection)) {
          const feature = hydraulicModel.assets.get(id);
          if (feature) features.push(feature);
        }
        return features;
      }
    }
  },
  isSelected(selection: Sel, id: IWrappedFeature["id"]): boolean {
    switch (selection.type) {
      case "none":
      case "folder":
      case "singleCustomerPoint": {
        return false;
      }
      case "single": {
        return selection.id === id;
      }
      case "multi": {
        return selection.ids.includes(id);
      }
    }
  },
  isFolderSelected(selection: Sel, id: IFolder["id"]): boolean {
    return selection.type === "folder" && selection.id === id;
  },
  isCustomerPointSelected(selection: Sel, id: number): boolean {
    return selection.type === "singleCustomerPoint" && selection.id === id;
  },
  isVertexSelected(selection: Sel, id: number, vertexId: VertexId): boolean {
    return (
      selection.type === "single" &&
      selection.id === id &&
      selection.parts.length === 1 &&
      selection.parts[0].vertex === vertexId.vertex
    );
  },
  /**
   * Note: only deals in top-level uids,
   * not RawId components.
   */
  toggleSelectionId(selection: Sel, id: IWrappedFeature["id"]): Sel {
    const ids = this.toIds(selection);
    const updatedIds = toggle(ids, id);
    return this.fromIds(updatedIds);
  },
  toggleSingleSelectionId(selection: Sel, id: IWrappedFeature["id"]): Sel {
    if (selection.type === "single" && this.isSelected(selection, id)) {
      return this.none();
    }
    return this.single(id);
  },
  addSelectionId(selection: Sel, id: IWrappedFeature["id"]): Sel {
    const ids = this.toIds(selection);
    if (ids.includes(id)) return selection;
    return this.fromIds(ids.concat(id));
  },
  addSelectionIds(selection: Sel, newIds: IWrappedFeature["id"][]): Sel {
    const currentIds = this.toIds(selection);
    const currentSet = new Set(currentIds);
    const uniqueNewIds = newIds.filter((id) => !currentSet.has(id));
    if (uniqueNewIds.length === 0) return selection;
    return this.fromIds([...currentIds, ...uniqueNewIds]);
  },
  removeFeatureFromSelection(selection: Sel, id: IWrappedFeature["id"]): Sel {
    switch (selection.type) {
      case "folder":
      case "none":
      case "singleCustomerPoint": {
        return selection;
      }
      case "single": {
        if (selection.id === id) {
          return SELECTION_NONE;
        } else {
          return selection;
        }
      }
      case "multi": {
        if (selection.ids.includes(id)) {
          const newIds = selection.ids.filter((sid) => sid !== id);
          return this.fromIds(newIds);
        } else {
          return selection;
        }
      }
    }
  },
  removeSelectionIds(
    selection: Sel,
    idsToRemove: IWrappedFeature["id"][],
  ): Sel {
    const currentIds = this.toIds(selection);
    const removeSet = new Set(idsToRemove);
    const remainingIds = currentIds.filter((id) => !removeSet.has(id));
    return this.fromIds(remainingIds);
  },
  none(): Sel {
    return SELECTION_NONE;
  },
  /**
   * Get the folder id from a folder selection,
   * if there is one.
   */
  folderId(selection: Sel): string | null {
    if (selection.type === "folder") {
      return selection.id;
    }
    return null;
  },
  folder(id: IFolder["id"]): SelFolder {
    return {
      type: "folder",
      id,
    };
  },
  single(id: IWrappedFeature["id"]): SelSingle {
    return {
      type: "single",
      id,
      parts: [],
    };
  },
  singleCustomerPoint(id: number): SelSingleCustomerPoint {
    return {
      type: "singleCustomerPoint",
      id,
    };
  },
  clearInvalidIds(
    selection: Sel,
    assets: AssetsMap,
    customerPoints: CustomerPoints,
  ): Sel {
    switch (selection.type) {
      case "single":
        return assets.has(selection.id) ? selection : SELECTION_NONE;
      case "multi":
        return selection.ids.every((id) => assets.has(id))
          ? selection
          : SELECTION_NONE;
      case "singleCustomerPoint":
        return customerPoints.has(selection.id) ? selection : SELECTION_NONE;
      case "none":
      case "folder":
        return selection;
    }
  },
};

export const SELECTION_NONE: Sel = {
  type: "none",
};
