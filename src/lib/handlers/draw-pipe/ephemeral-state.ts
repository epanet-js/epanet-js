import { Position } from "geojson";
import { Pipe } from "src/hydraulics/assets";

export interface EphemeralDrawPipe {
  type: "drawPipe";
  pipe: Pipe;
  snappingCandidate: Position | null;
}
