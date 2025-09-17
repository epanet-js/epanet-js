import { Position } from "src/types";

type NodeType = "junction" | "reservoir" | "tank";

export interface EphemeralDrawNode {
  type: "drawNode";
  nodeType: NodeType;
  pipeSnappingPosition: Position | null;
  pipeId: string | null;
  nodeSnappingId: string | null;
}
