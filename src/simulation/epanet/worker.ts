import {
  CountType,
  InitHydOption,
  NodeProperty,
  Project,
  Workspace,
} from "epanet-js";
import { SimulationStatus } from "../result";

import { NodeResults } from "./epanet-results";

export const runSimulation = (
  inp: string,
): { status: SimulationStatus; report: string; nodeResults: NodeResults } => {
  const ws = new Workspace();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);

  try {
    model.open("net.inp", "report.rpt", "results.out");
    model.openH();
    model.initH(InitHydOption.SaveAndInit);
    model.runH();

    const nodeResults = readNodeResults(model);
    model.close();

    return {
      status: "success",
      report: ws.readFile("report.rpt"),
      nodeResults,
    };
  } catch (error) {
    model.copyReport("error.rpt");
    const report = ws.readFile("report.rpt");

    return {
      status: "failure",
      report:
        report.length > 0 ? curateReport(report) : (error as Error).message,
      nodeResults: {},
    };
  }
};

const readNodeResults = (model: Project) => {
  const nodeResults: NodeResults = {};
  const nodesCount = model.getCount(CountType.NodeCount);
  for (let i = 1; i <= nodesCount; i++) {
    const id = model.getNodeId(i);
    const pressure = model.getNodeValue(i, NodeProperty.Pressure);
    nodeResults[id] = { pressure };
  }
  return nodeResults;
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
