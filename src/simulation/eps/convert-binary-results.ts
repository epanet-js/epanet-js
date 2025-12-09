/**
 * Converts EPANET binary timestep results to SimulationResults format.
 *
 * This allows the main thread to read results from IndexedDB and convert
 * them to the same format used by the direct EPANET API extraction.
 */

import {
  JunctionSimulation,
  PipeSimulation,
  PumpSimulation,
  TankSimulation,
  ValveSimulation,
} from "../results-reader";
import { SimulationResults } from "../epanet/epanet-results";
import { BinaryLinkType, EpanetBinaryReader } from "./epanet-binary-reader";
import type { TankTimestepData } from "./eps-store";

/**
 * Binary output status values match EPANET API status codes:
 * - 0: Closed (temporarily)
 * - 1: Open (CV pipe at setting)
 * - 2: Closed (by user status setting)
 * - 3: Open
 * - 4: Active (partially open valve)
 * - 5: Open (pump cannot deliver flow)
 * - 6: Open (pump cannot deliver head)
 * - 7: Open (valve cannot deliver flow)
 * - 8: Open (valve cannot deliver pressure)
 *
 * Status < 3 is considered closed, >= 3 is open/active.
 */
const BINARY_STATUS_OPEN_THRESHOLD = 3;

/**
 * Converts binary timestep results to SimulationResults format.
 *
 * Note: Status warnings (cannot-deliver-flow, etc.) are not available in
 * binary output format and will be set to null.
 *
 * @param reader - Binary reader for the simulation output
 * @param timestepIndex - Index of the timestep to convert
 * @param tankData - Optional tank level/volume data captured during simulation
 */
export function convertTimestepToSimulationResults(
  reader: EpanetBinaryReader,
  timestepIndex: number,
  tankData?: Map<string, TankTimestepData[]>,
): SimulationResults {
  const results: SimulationResults = new Map();
  const timestep = reader.getTimestepResults(timestepIndex);
  const linkTypes = reader.getLinkTypes();

  // Convert node results
  for (let i = 0; i < timestep.nodes.length; i++) {
    const node = timestep.nodes[i];

    if (reader.isTankOrReservoir(i)) {
      // Tank or reservoir - use TankSimulation type
      // Level is stored as pressure in binary; volume from tankData
      const tankTimesteps = tankData?.get(node.id);
      const tankValues = tankTimesteps?.[timestepIndex];
      const tankResult: TankSimulation = {
        type: "tank",
        pressure: node.pressure,
        head: node.head,
        level: node.pressure, // Tank level is stored as pressure in binary
        volume: tankValues?.volume ?? 0,
      };
      results.set(node.id, tankResult);
    } else {
      // Junction
      const junctionResult: JunctionSimulation = {
        type: "junction",
        pressure: node.pressure,
        head: node.head,
        demand: node.demand,
      };
      results.set(node.id, junctionResult);
    }
  }

  // Convert link results
  for (let i = 0; i < timestep.links.length; i++) {
    const link = timestep.links[i];
    const linkType = linkTypes[i];
    // Binary status: < 3 = closed, >= 3 = open/active
    const isOpen = link.status >= BINARY_STATUS_OPEN_THRESHOLD;

    if (linkType === BinaryLinkType.Pump) {
      const pumpResult: PumpSimulation = {
        type: "pump",
        flow: link.flow,
        headloss: link.headloss,
        status: isOpen ? "on" : "off",
        statusWarning: null, // Not available in binary format
      };
      results.set(link.id, pumpResult);
    } else if (isValveType(linkType)) {
      const valveResult: ValveSimulation = {
        type: "valve",
        flow: link.flow,
        velocity: link.velocity,
        headloss: link.headloss,
        status: valveStatusFromBinary(link.status),
        statusWarning: null, // Not available in binary format
      };
      results.set(link.id, valveResult);
    } else {
      // Pipe or CV Pipe
      const pipeResult: PipeSimulation = {
        type: "pipe",
        flow: link.flow,
        velocity: link.velocity,
        headloss: link.headloss,
        unitHeadloss: 0, // Would need link length to calculate, not in timestep data
        status: isOpen ? "open" : "closed",
      };
      results.set(link.id, pipeResult);
    }
  }

  return results;
}

function isValveType(linkType: BinaryLinkType): boolean {
  return (
    linkType === BinaryLinkType.PRV ||
    linkType === BinaryLinkType.PSV ||
    linkType === BinaryLinkType.PBV ||
    linkType === BinaryLinkType.FCV ||
    linkType === BinaryLinkType.TCV ||
    linkType === BinaryLinkType.GPV
  );
}

/**
 * Convert binary status code to valve status.
 * Status 4 = active (partially open), 3+ = open, < 3 = closed
 */
function valveStatusFromBinary(status: number): ValveSimulation["status"] {
  if (status === 4) return "active";
  if (status >= BINARY_STATUS_OPEN_THRESHOLD) return "open";
  return "closed";
}

/**
 * Creates a SimulationResults from binary data for a specific timestep.
 * Convenience function that creates a reader and converts in one call.
 */
export function binaryToSimulationResults(
  binaryData: Uint8Array,
  timestepIndex: number = 0,
): SimulationResults {
  const reader = new EpanetBinaryReader(binaryData);
  return convertTimestepToSimulationResults(reader, timestepIndex);
}
