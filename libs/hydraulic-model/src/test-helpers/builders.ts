import { Position } from "geojson";
import {
  AssetFactory,
  LabelManager,
  CustomerPoint,
  JunctionBuildData,
  PipeBuildData,
  PumpBuildData,
  ReservoirBuildData,
} from "..";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { testDefaults } from "./defaults";

const factory = () =>
  new AssetFactory(
    testDefaults,
    new ConsecutiveIdsGenerator(),
    new LabelManager(),
  );

export const buildPipe = (data: PipeBuildData = {}) =>
  factory().createPipe(data);

export const buildPump = (data: PumpBuildData = {}) =>
  factory().createPump(data);

export const buildJunction = (data: JunctionBuildData = {}) =>
  factory().createJunction(data);

export const buildReservoir = (data: ReservoirBuildData = {}) =>
  factory().createReservoir(data);

export const buildCustomerPoint = (
  id: number,
  options: {
    coordinates?: Position;
    junctionId?: number;
    label?: string;
  } = {},
) => {
  const { coordinates = [0, 0], label = String(id) } = options;
  return new CustomerPoint(id, coordinates, { label });
};
