import type { IdPool } from "@epanet-js/id-generator";
import type { LabelType } from "./label-manager";

const idPoolByType: Record<LabelType, IdPool> = {
  junction: "asset",
  reservoir: "asset",
  tank: "asset",
  pipe: "asset",
  pump: "asset",
  valve: "asset",
  customerPoint: "asset",
  pattern: "pattern",
  curve: "curve",
};

export const idPoolOf = (type: LabelType): IdPool => idPoolByType[type];

export const sharesIdPool = (typeA: LabelType, typeB: LabelType): boolean =>
  idPoolOf(typeA) === idPoolOf(typeB);
