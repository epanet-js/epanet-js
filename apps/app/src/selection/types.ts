/**
 * The kinds of selectable entities tracked by a multi-selection or by a
 * kinded `single` selection. Extend with new kinds (e.g. `"zone"`) as needed.
 */
export type Category = "asset" | "customerPoint";

/**
 * A selection of a single feature. `kind` discriminates whether the id refers
 * to an asset or a customer point.
 */
export interface SelSingle {
  type: "single";
  kind: Category;
  id: number;
}

export interface SelMulti {
  type: "multi";
  ids: { readonly [K in Category]?: readonly number[] };
}

/**
 * This is not an abbreviation, it is named Sel
 * instead of Selection for safety: otherwise
 * window.Selection will sneak in if you don't
 * import the type.
 */
export type Sel =
  | SelMulti
  | {
      type: "none";
    }
  | SelSingle;
