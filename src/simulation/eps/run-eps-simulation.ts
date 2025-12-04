/**
 * EPS Simulation Runner
 *
 * Runs an Extended Period Simulation and stores the raw EPANET binary output
 * in IndexedDB for later timestep-by-timestep access.
 */

import { Project, Workspace } from "epanet-js";
import { SimulationStatus } from "../result";
import {
  saveEPSSimulation,
  type EPSSimulationMetadata,
  type EPSSimulationRecord,
} from "./eps-store";
import { parseProlog } from "./epanet-binary-reader";

export type EPSSimulationResult = {
  status: SimulationStatus;
  report: string;
  simulationId: string;
  metadata: EPSSimulationMetadata;
};

/**
 * Runs an EPS simulation and stores the binary output in IndexedDB.
 *
 * Unlike the steady-state simulation which returns results directly,
 * this stores results in IndexedDB and returns metadata for later access.
 */
export const runEPSSimulation = async (
  inp: string,
  simulationId: string,
): Promise<EPSSimulationResult> => {
  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);

  try {
    // Open model and run full hydraulic simulation
    model.open("net.inp", "report.rpt", "results.out");
    model.solveH(); // Runs full EPS simulation
    model.saveH(); // Save binary output to results.out

    // Read the binary output file
    const binaryData = ws.readFile("results.out", "binary");

    // Parse prolog to get metadata
    const prolog = parseProlog(binaryData);

    // Create metadata
    const metadata: EPSSimulationMetadata = {
      simulationId,
      createdAt: Date.now(),
      duration: 0, // TODO: extract from INP or time parameters
      timestepCount: prolog.reportingPeriods,
      nodeCount: prolog.nodeCount,
      linkCount: prolog.linkCount,
    };

    // Store in IndexedDB
    const record: EPSSimulationRecord = {
      metadata,
      binaryData,
    };
    await saveEPSSimulation(record);

    model.close();

    const report = ws.readFile("report.rpt");

    return {
      status: report.includes("WARNING") ? "warning" : "success",
      report: curateReport(report),
      simulationId,
      metadata,
    };
  } catch (error) {
    model.close();
    const report = ws.readFile("report.rpt");

    // Create error metadata
    const errorMetadata: EPSSimulationMetadata = {
      simulationId,
      createdAt: Date.now(),
      duration: 0,
      timestepCount: 0,
      nodeCount: 0,
      linkCount: 0,
    };

    return {
      status: "failure",
      report:
        report.length > 0 ? curateReport(report) : (error as Error).message,
      simulationId,
      metadata: errorMetadata,
    };
  }
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
