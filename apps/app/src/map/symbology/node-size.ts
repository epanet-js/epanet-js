// The NodeSizeConfig *type* lives in @epanet-js/map (the render primitives type
// against it); the concrete default is the app's, passed in to the render code.
import type { NodeSizeConfig } from "@epanet-js/map";
export type { NodeSizeConfig };

export const defaultNodeSizeConfig: NodeSizeConfig = {
  minVisibleZoom: 12,
  minSize: 1,
  maxSize: 12,
};
