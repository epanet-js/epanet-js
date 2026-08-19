import type { Position } from "geojson";
import type { FlowUnit, LengthUnit, PressureUnit } from "@epanet-js/quantity";

export type SourceUnits = {
  flow?: FlowUnit;
  pressure?: PressureUnit;
  elevation?: LengthUnit;
};

export type SourceCrs = { type: "epsg"; code: number } | { type: "unknown" };

export type JunctionData = {
  ref: string;
  label?: string;
  coordinates: Position;
  elevation?: number;
};

export type NetworkData = {
  junctions: JunctionData[];
  units: SourceUnits;
  crs: SourceCrs;
};

export const emptyNetworkData = (): NetworkData => ({
  junctions: [],
  units: {},
  crs: { type: "unknown" },
});
