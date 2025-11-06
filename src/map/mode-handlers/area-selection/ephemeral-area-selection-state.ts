import { Mode } from "src/state/mode";

export interface EphemeralEditingStateAreaSelection {
  type: "areaSelect";
  selectionMode:
    | Mode.SELECT_RECTANGULAR
    | Mode.SELECT_POLYGONAL
    | Mode.SELECT_FREEHAND;
  points: Pos2[];
  isValid: boolean;
}
