import { Position } from "geojson";
import { BaseAsset, AssetId, AssetProperties } from "./base-asset";
import { NodeType } from "./types";
import { PatternId } from "../patterns";

export const chemicalSourceTypes = [
  "CONCEN",
  "MASS",
  "FLOWPACED",
  "SETPOINT",
] as const;

export type ChemicalSourceType = (typeof chemicalSourceTypes)[number];

export type NodeProperties = {
  elevation: number;
  type: NodeType;
  initialWaterAge: number;
  initialChemicalConcentration: number;
  chemicalSourceType?: ChemicalSourceType;
  chemicalSourceStrength?: number;
  chemicalSourcePatternId?: PatternId;
} & AssetProperties;

export class Node<T> extends BaseAsset<T & NodeProperties> {
  constructor(
    id: AssetId,
    coordinates: Position,
    attributes: T & NodeProperties,
  ) {
    super(id, { type: "Point", coordinates }, attributes);
  }

  get isLink() {
    return false;
  }

  get isNode() {
    return true;
  }

  get coordinates() {
    return this.geometry.coordinates as Position;
  }

  get elevation() {
    return this.properties.elevation;
  }

  setCoordinates(newCoordinates: Position) {
    this.geometry.coordinates = newCoordinates;
  }

  setElevation(elevation: number) {
    this.properties.elevation = elevation;
  }

  get initialChemicalConcentration() {
    return this.properties.initialChemicalConcentration;
  }

  get chemicalSourceType() {
    return this.properties.chemicalSourceType;
  }

  get chemicalSourceStrength() {
    return this.properties.chemicalSourceStrength;
  }

  get chemicalSourcePatternId() {
    return this.properties.chemicalSourcePatternId;
  }
}
