// Layout pixel constants. JS-side mirrors of Tailwind utilities applied in
// cell CSS, so layout math (virtualizer estimates, scroll shadows,
// scroll-into-view offsets) can compute positions that match the rendered DOM.

// Row height — matches `h-8` on data/gutter/actions cells.
export const ROW_HEIGHT = 32;

// Width of the fixed-size gutter (row selector) and row-actions columns —
// matches `w-8` on those cells.
export const FIXED_COLUMN_SIZE = 32;
