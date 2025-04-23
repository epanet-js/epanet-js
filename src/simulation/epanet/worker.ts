import {
  CountType,
  InitHydOption,
  LinkProperty,
  LinkType,
  NodeProperty,
  NodeType,
  Project,
  Workspace,
} from "epanet-js";
import { SimulationStatus } from "../result";

import { NodeResults, LinkResults } from "./epanet-results";
import { PumpSimulation, ValveSimulation } from "../results-reader";

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
    const type = model.getNodeType(i);
    if (type === NodeType.Junction) {
      appendJunctionResults(model, nodeResults, i);
    }
  }
  return nodeResults;
};

const isValve = (epanetType: LinkType) => {
  return (
    epanetType === LinkType.FCV ||
    epanetType === LinkType.GPV ||
    epanetType === LinkType.PRV ||
    epanetType === LinkType.PSV ||
    epanetType === LinkType.PBV ||
    epanetType === LinkType.TCV
  );
};

const readLinkResults = (model: Project) => {
  const linkResults: LinkResults = new Map();

  const linksCount = model.getCount(CountType.LinkCount);
  for (let i = 1; i <= linksCount; i++) {
    const type = model.getLinkType(i);
    if (isValve(type)) {
      appendValveResults(model, linkResults, i);
    } else if (type === LinkType.Pump) {
      appendPumpResults(model, linkResults, i);
    } else {
      appendPipeResults(model, linkResults, i);
    }
  }
  return linkResults;
};

const appendJunctionResults = (
  model: Project,
  nodeResults: NodeResults,
  index: number,
) => {
  const id = model.getNodeId(index);
  const pressure = model.getNodeValue(index, NodeProperty.Pressure);
  nodeResults.set(id, { type: "junction", pressure });
};

const appendPipeResults = (
  model: Project,
  linkResults: LinkResults,
  index: number,
) => {
  const id = model.getLinkId(index);
  const flow = model.getLinkValue(index, LinkProperty.Flow);
  const velocity = model.getLinkValue(index, LinkProperty.Velocity);
  const headloss = model.getLinkValue(index, LinkProperty.Headloss);
  linkResults.set(id, {
    type: "pipe",
    flow,
    velocity,
    headloss,
  });
};

// There's a hack to read the valve status by getting PumpState
// Learn more: https://github.com/OpenWaterAnalytics/EPANET/issues/218
const appendValveResults = (
  model: Project,
  linkResults: LinkResults,
  index: number,
) => {
  const id = model.getLinkId(index);
  const flow = model.getLinkValue(index, LinkProperty.Flow);
  const velocity = model.getLinkValue(index, LinkProperty.Velocity);
  const headloss = model.getLinkValue(index, LinkProperty.Headloss);
  const linkStatusCode = model.getLinkValue(index, LinkProperty.PumpState);
  const { status, warning: statusWarning } = valveStatusFor(linkStatusCode);
  linkResults.set(id, {
    type: "valve",
    flow,
    velocity,
    headloss,
    status,
    statusWarning: (statusWarning
      ? statusWarning
      : null) as ValveSimulation["statusWarning"],
  });
};

const appendPumpResults = (
  model: Project,
  linkResults: LinkResults,
  index: number,
) => {
  const id = model.getLinkId(index);
  const flow = model.getLinkValue(index, LinkProperty.Flow);
  const headloss = model.getLinkValue(index, LinkProperty.Headloss);
  const linkStatusCode = model.getLinkValue(index, LinkProperty.PumpState);
  const { status, warning: statusWarning } = pumpStatusFor(linkStatusCode);
  linkResults.set(id, {
    type: "pump",
    flow,
    headloss,
    status,
    statusWarning: (statusWarning
      ? statusWarning
      : null) as PumpSimulation["statusWarning"],
  });
};

export const valveStatusFor = (
  linkStatusCode: number,
): { status: "open" | "closed" | "active"; warning?: string } => {
  if (linkStatusCode < 3) return { status: "closed" };
  if (linkStatusCode === 4) return { status: "active" };

  if (linkStatusCode === 6)
    return { status: "open", warning: "cannot-deliver-flow" };
  if (linkStatusCode === 7)
    return { status: "open", warning: "cannot-deliver-pressure" };

  return { status: "open" };
};

export const pumpStatusFor = (
  linkStatusCode: number,
): { status: "on" | "off"; warning?: string } => {
  if (linkStatusCode === 5)
    return { status: "on", warning: "cannot-deliver-flow" };
  if (linkStatusCode === 0)
    return { status: "off", warning: "cannot-deliver-head" };

  if (linkStatusCode < 3) return { status: "off" };

  return { status: "on" };
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
