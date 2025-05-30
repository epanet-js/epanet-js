import {
  CountType,
  LinkProperty,
  LinkType,
  NodeProperty,
  NodeType,
  Project,
} from "epanet-js";
import { SimulationResults } from "./epanet-results";
import { PumpSimulation, ValveSimulation } from "../results-reader";

export const extractSimulationResults = (model: Project): SimulationResults => {
  const results: SimulationResults = new Map();
  appendNodeResults(results, model);
  appendLinkResults(results, model);
  return results;
};

const appendNodeResults = (results: SimulationResults, model: Project) => {
  const nodesCount = model.getCount(CountType.NodeCount);
  for (let i = 1; i <= nodesCount; i++) {
    const type = model.getNodeType(i);
    if (type === NodeType.Junction) {
      appendJunctionResults(results, model, i);
    }
  }
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

const appendLinkResults = (results: SimulationResults, model: Project) => {
  const linksCount = model.getCount(CountType.LinkCount);
  for (let i = 1; i <= linksCount; i++) {
    const type = model.getLinkType(i);
    if (isValve(type)) {
      appendValveResults(results, model, i);
    } else if (type === LinkType.Pump) {
      appendPumpResults(results, model, i);
    } else {
      appendPipeResults(results, model, i);
    }
  }
};

const appendJunctionResults = (
  results: SimulationResults,
  model: Project,
  index: number,
) => {
  const id = model.getNodeId(index);
  const pressure = model.getNodeValue(index, NodeProperty.Pressure);
  const head = model.getNodeValue(index, NodeProperty.Head);
  results.set(id, { type: "junction", pressure, head });
};

const appendPipeResults = (
  results: SimulationResults,
  model: Project,
  index: number,
) => {
  const id = model.getLinkId(index);
  const flow = model.getLinkValue(index, LinkProperty.Flow);
  const velocity = model.getLinkValue(index, LinkProperty.Velocity);
  const headloss = model.getLinkValue(index, LinkProperty.Headloss);
  const length = model.getLinkValue(index, LinkProperty.Length);
  const unitHeadloss = length === 0 ? 0 : headloss / (length / 1000);
  results.set(id, {
    type: "pipe",
    flow,
    velocity,
    headloss,
    unitHeadloss,
  });
};

// There's a hack to read the valve status by getting PumpState
// Learn more: https://github.com/OpenWaterAnalytics/EPANET/issues/218
const appendValveResults = (
  results: SimulationResults,
  model: Project,
  index: number,
) => {
  const id = model.getLinkId(index);
  const flow = model.getLinkValue(index, LinkProperty.Flow);
  const velocity = model.getLinkValue(index, LinkProperty.Velocity);
  const headloss = model.getLinkValue(index, LinkProperty.Headloss);
  const linkStatusCode = model.getLinkValue(index, LinkProperty.PumpState);
  const { status, warning: statusWarning } = valveStatusFor(linkStatusCode);
  results.set(id, {
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
  results: SimulationResults,
  model: Project,
  index: number,
) => {
  const id = model.getLinkId(index);
  const flow = model.getLinkValue(index, LinkProperty.Flow);
  const headloss = model.getLinkValue(index, LinkProperty.Headloss);
  const linkStatusCode = model.getLinkValue(index, LinkProperty.PumpState);
  const { status, warning: statusWarning } = pumpStatusFor(linkStatusCode);
  results.set(id, {
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
