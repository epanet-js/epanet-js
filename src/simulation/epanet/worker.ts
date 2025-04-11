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
  flags: Record<string, boolean>,
): {
  status: SimulationStatus;
  report: string;
  nodeResults: NodeResults;
  linkResults: LinkResults;
} => {
  // eslint-disable-next-line
  if (Object.keys(flags).length) console.log("Running with flags", flags);

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

    const report = ws.readFile("report.rpt");

    return {
      status: report.includes("WARNING") ? "warning" : "success",
      report: curateReport(report),
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
    const velocity = model.getLinkValue(i, LinkProperty.Velocity);
    const headloss = model.getLinkValue(i, LinkProperty.Headloss);
    const pumpState = model.getLinkValue(i, LinkProperty.PumpState);
    linkResults.set(id, { flow, velocity, headloss, pumpState });
  }
  return linkResults;
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
