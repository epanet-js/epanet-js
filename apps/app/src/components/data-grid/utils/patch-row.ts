import type { RowData } from "@tanstack/react-table";

/**
 * Produces a new row reflecting `patches` over `row`, used by every grid write
 * path (cell edit, paste, delete). The strategy varies by row representation:
 * see `defaultPatchRow` (plain flat rows) and `patchModelRow` (model objects).
 */
export type PatchRowFn = <TData extends RowData>(
  row: TData,
  patches: Record<string, unknown>,
) => TData;

/** Plain flat rows: a shallow spread captures every (own, enumerable) value. */
export const defaultPatchRow: PatchRowFn = (row, patches) =>
  ({
    ...(row as Record<string, unknown>),
    ...patches,
  }) as typeof row;

/**
 * Model-object rows: attributes live behind prototype getters that an object
 * spread would drop. Layer the edited cells as own properties over the original
 * via `Object.create`, so unedited attributes still resolve through the
 * prototype and `Object.keys()` returns exactly the edited column ids.
 */
export const patchModelRow: PatchRowFn = (row, patches) => {
  const descriptors: PropertyDescriptorMap = {};
  for (const [key, value] of Object.entries(patches)) {
    descriptors[key] = {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    };
  }
  return Object.create(row as object, descriptors) as typeof row;
};
