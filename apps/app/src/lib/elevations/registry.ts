import {
  type ElevationEngine,
  defaultElevationEngine,
} from "@epanet-js/elevations";

let engine: ElevationEngine = defaultElevationEngine;

export const registerElevationEngine = (next: ElevationEngine): void => {
  engine = next;
};

export const getElevationEngine = (): ElevationEngine => engine;
