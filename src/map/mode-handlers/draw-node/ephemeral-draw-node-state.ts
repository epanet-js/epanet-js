import { Position } from "src/types";

export interface EphemeralDrawNode {
  type: "drawNode";
  pipeSnappingPosition: Position | null;
  pipeId: string | null;
}
