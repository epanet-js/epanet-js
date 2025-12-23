import { atom } from "jotai";
import { IWrappedFeature } from "src/types";

/**
 * Map drawing mode
 */
export enum Mode {
  NONE = "NONE",
  SELECT_RECTANGULAR = "SELECT_RECTANGULAR",
  SELECT_POLYGONAL = "SELECT_POLYGONAL",
  SELECT_FREEHAND = "SELECT_FREEHAND",
  DRAW_JUNCTION = "DRAW_JUNCTION",
  DRAW_PIPE = "DRAW_PIPE",
  DRAW_RESERVOIR = "DRAW_RESERVOIR",
  DRAW_PUMP = "DRAW_PUMP",
  DRAW_VALVE = "DRAW_VALVE",
  DRAW_TANK = "DRAW_TANK",
  CONNECT_CUSTOMER_POINTS = "CONNECT_CUSTOMER_POINTS",
  REDRAW_LINK = "REDRAW_LINK",
}

export enum CIRCLE_TYPE {
  MERCATOR = "Mercator",
  GEODESIC = "Geodesic",
  DEGREES = "Degrees",
}

export interface ModeOptions {
  /**
   * A weird special case: in "none" mode,
   * you can resize a rectangle. This shows a help
   * menu item showing that you can _avoid_ this behavior
   * by hitting a key.
   */
  hasResizedRectangle?: boolean;
  /**
   * This is for lines: if someone clicks on the first
   * vertex of a line to continue it from there, we need
   * to remember to add points to that end.
   */
  reverse?: boolean;

  circleType?: CIRCLE_TYPE;

  /**
   * Replace geometry of the feature with the given ID
   */
  replaceGeometryForId?: IWrappedFeature["id"] | null;
}

export const MODE_INFO: Record<
  Mode,
  {
    name: string;
  }
> = {
  [Mode.NONE]: { name: "select" },
  [Mode.SELECT_RECTANGULAR]: { name: "rectangular selection" },
  [Mode.SELECT_POLYGONAL]: { name: "polygonal selection" },
  [Mode.SELECT_FREEHAND]: { name: "freehand selection" },
  [Mode.DRAW_JUNCTION]: { name: "junction" },
  [Mode.DRAW_PIPE]: { name: "pipe" },
  [Mode.DRAW_RESERVOIR]: { name: "reservoir" },
  [Mode.DRAW_PUMP]: { name: "pump" },
  [Mode.DRAW_VALVE]: { name: "valve" },
  [Mode.DRAW_TANK]: { name: "tank" },
  [Mode.CONNECT_CUSTOMER_POINTS]: { name: "connect customer points" },
  [Mode.REDRAW_LINK]: { name: "redraw link" },
};

export type ModeWithOptions = {
  mode: Mode;
  modeOptions?: ModeOptions;
};

export const modeAtom = atom<ModeWithOptions>({
  mode: Mode.NONE,
});

export const lastSelectionModeAtom = atom<Mode>(Mode.SELECT_POLYGONAL);
