import { InitHydOption, Project, Workspace } from "epanet-js";
import { SimulationStatus } from "../result";

import { SimulationResults } from "./epanet-results";
import { extractSimulationResults } from "./extract-simulation-results";

export const runSimulation = async (
  inp: string,
  flags: Record<string, boolean>,
): Promise<{
  status: SimulationStatus;
  report: string;
  results: SimulationResults;
}> => {
  // eslint-disable-next-line
  if (Object.keys(flags).length) console.log("Running with flags", flags);

  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);

  try {
    model.open("net.inp", "report.rpt", "results.out");
    model.openH();
    model.initH(InitHydOption.SaveAndInit);
    model.runH();

    const results = extractSimulationResults(model);
    model.close();

    const report = ws.readFile("report.rpt");

    return {
      status: report.includes("WARNING") ? "warning" : "success",
      report: curateReport(report),
      results,
    };
  } catch (error) {
    model.close();
    const report = ws.readFile("report.rpt");

    return {
      status: "failure",
      report:
        report.length > 0 ? curateReport(report) : (error as Error).message,
      results: new Map(),
    };
  }
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
