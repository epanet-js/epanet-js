/**
 * The kinds of selectable entities tracked by a selection. Extend with new
 * kinds (e.g. `"zone"`) as needed.
 */
export type Category = "asset" | "customerPoint";

/**
 * A selection is a pair of id lists, one per Category. "none" and "single"
 * are derived notions (see `USelection.isNone` / `isSingleAsset`), not separate
 * representations: keeping the per-kind arrays as the only state lets an update
 * that touches one kind preserve the other kind's array reference, so consumers
 * (e.g. map redraw diffing) can detect per-kind changes by reference identity.
 *
 * This is not an abbreviation, it is named Sel instead of Selection for safety:
 * otherwise window.Selection will sneak in if you don't import the type.
 */
export interface Sel {
  readonly asset: readonly number[];
  readonly customerPoint: readonly number[];
}
