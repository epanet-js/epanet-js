import { atom } from "jotai";
import { translate } from "src/infra/i18n";
import { IWrappedFeature } from "src/types";

/**
 * Map drawing mode
 */
export enum Mode {
  NONE = "NONE",
  DRAW_JUNCTION = "DRAW_JUNCTION",
  DRAW_PIPE = "DRAW_PIPE",
  DRAW_RESERVOIR = "DRAW_RESERVOIR",
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
  /**
   * Accessed by shift-clicking mode buttons or adding
   * shift to the shortcuts, this lets people
   * draw multiple features by staying in the drawing
   * mode after finishing a feature.
   */
  multi?: boolean;

  circleType?: CIRCLE_TYPE;

  /**
   * Replace geometry of the feature with the given ID
   */
  replaceGeometryForId?: IWrappedFeature["id"] | null;
}

export const MODE_INFO: Record<
  Mode,
  {
    label: string;
  }
> = {
  [Mode.NONE]: { label: translate("select") },
  [Mode.DRAW_JUNCTION]: { label: translate("junction") },
  [Mode.DRAW_PIPE]: { label: translate("pipe") },
  [Mode.DRAW_RESERVOIR]: { label: translate("reservoir") },
};

export type ModeWithOptions = {
  mode: Mode;
  modeOptions?: ModeOptions;
};

export const modeAtom = atom<ModeWithOptions>({
  mode: Mode.NONE,
});
