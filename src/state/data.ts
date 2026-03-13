import { atom } from "jotai";
import type { Sel } from "src/selection/types";
import { FolderMap } from "src/types";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { ModelMetadata } from "src/model-metadata";
import { createProjectionMapper } from "src/projections";

/**
 * Core data
 */
export interface Data {
  folderMap: FolderMap;
  selection: Sel;
  modelMetadata: ModelMetadata;
}

const quantities = new Quantities(presets.LPS);
const modelMetadata: ModelMetadata = {
  quantities,
  units: presets.LPS.units,
  defaults: presets.LPS.defaults,
  headlossFormula: "H-W",
  formatting: { decimals: presets.LPS.decimals, defaultDecimals: 3 },
  projectionMapper: createProjectionMapper({ type: "wgs84" }),
};
export const nullData: Data = {
  folderMap: new Map(),
  selection: {
    type: "none",
  },
  modelMetadata,
};
export const dataAtom = atom<Data>(nullData);
