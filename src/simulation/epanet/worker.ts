import {
  CountType,
  InitHydOption,
  LinkProperty,
  LinkType,
  NodeProperty,
  Project,
  Workspace,
} from "epanet-js";
import { SimulationStatus } from "../result";

import { NodeResults, LinkResults } from "./epanet-results";
import { ValveSimulation } from "../results-reader";

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
    const linkResults = flags.FLAG_VALVE
      ? readLinkResults(model)
      : readLinkResultsDeprecated(model);
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

const readLinkResultsDeprecated = (model: Project) => {
  const linkResults: LinkResults = new Map();

  const linksCount = model.getCount(CountType.LinkCount);
  for (let i = 1; i <= linksCount; i++) {
    const id = model.getLinkId(i);
    const flow = model.getLinkValue(i, LinkProperty.Flow);
    const velocity = model.getLinkValue(i, LinkProperty.Velocity);
    const headloss = model.getLinkValue(i, LinkProperty.Headloss);
    const pumpState = model.getLinkValue(i, LinkProperty.PumpState);
    linkResults.set(id, { type: "link", flow, velocity, headloss, pumpState });
  }
  return linkResults;
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
    } else {
      const id = model.getLinkId(i);
      const flow = model.getLinkValue(i, LinkProperty.Flow);
      const velocity = model.getLinkValue(i, LinkProperty.Velocity);
      const headloss = model.getLinkValue(i, LinkProperty.Headloss);
      const pumpState = model.getLinkValue(i, LinkProperty.PumpState);
      linkResults.set(id, {
        type: "link",
        flow,
        velocity,
        headloss,
        pumpState,
      });
    }
  }
  return linkResults;
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

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
