export interface SelFolder {
  type: "folder";
  /**
   * The folder's id
   */
  id: StringId;
}

/**
 * A selection of a single feature.
 */
export interface SelSingle {
  type: "single";
  /**
   * The feature's id
   */
  id: StringId;
  parts: readonly VertexId[];
}

export interface SelMulti {
  type: "multi";
  ids: readonly StringId[];
  previousIds?: readonly StringId[];
}

export interface SelSingleCustomerPoint {
  type: "singleCustomerPoint";
  /**
   * The customer point's id
   */
  id: StringId;
}

/**
 * This is not an abbreviation, it is named Sel
 * instead of Selection for safety: otherwise
 * window.Selection will sneak in if you don't
 * import the type.
 */
export type Sel =
  | SelMulti
  | SelFolder
  | {
      type: "none";
    }
  | SelSingle
  | SelSingleCustomerPoint;

export const SELECTION_NONE: Sel = {
  type: "none",
};
