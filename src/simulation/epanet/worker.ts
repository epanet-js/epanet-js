import {
  CountType,
  InitHydOption,
  LinkProperty,
  NodeProperty,
  Project,
  Workspace,
} from "epanet-js";
import { SimulationStatus } from "../result";

import { NodeResults, LinkResults } from "./epanet-results";

export const runSimulation = (
  inp: string,
): {
  status: SimulationStatus;
  report: string;
  nodeResults: NodeResults;
  linkResults: LinkResults;
} => {
  const ws = new Workspace();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);

  try {
    model.open("net.inp", "report.rpt", "results.out");
    model.openH();
    model.initH(InitHydOption.SaveAndInit);
    model.runH();

    const nodeResults = readNodeResults(model);
    const linkResults = readLinkResults(model);
    model.close();

    return {
      status: "success",
      report: ws.readFile("report.rpt"),
      nodeResults,
      linkResults,
    };
  } catch (error) {
    model.close();
    const report = ws.readFile("report.rpt");

    return {
      status: "failure",
      report:
        report.length > 0 ? curateReport(report) : (error as Error).message,
      nodeResults: new Map(),
      linkResults: new Map(),
    };
  }
};

const readNodeResults = (model: Project) => {
  const nodeResults: NodeResults = new Map();
  const nodesCount = model.getCount(CountType.NodeCount);
  for (let i = 1; i <= nodesCount; i++) {
    const id = model.getNodeId(i);
    const pressure = model.getNodeValue(i, NodeProperty.Pressure);
    nodeResults.set(id, { pressure });
  }
  return nodeResults;
};

const readLinkResults = (model: Project) => {
  const linkResults: LinkResults = new Map();
  const linksCount = model.getCount(CountType.LinkCount);
  for (let i = 1; i <= linksCount; i++) {
    const id = model.getLinkId(i);
    const flow = model.getLinkValue(i, LinkProperty.Flow);
    linkResults.set(id, { flow });
  }
  return linkResults;
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
