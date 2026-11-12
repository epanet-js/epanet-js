import type { SimulationState } from "src/state/simulation";
import type { SymbologySpec } from "./symbology-types";

const resultOnlyProperties = [
  "flow",
  "velocity",
  "unitHeadloss",
  "pressure",
  "actualDemand",
  "head",
  "waterAge",
];

export const isColorPropertyAvailable = (
  property: string,
  simulation: SimulationState,
): boolean => {
  const reader =
    "epsResultsReader" in simulation ? simulation.epsResultsReader : undefined;
  const hasResults = !!reader;
  const isEps = (reader?.timestepCount ?? 0) > 1;

  if (resultOnlyProperties.includes(property) && !hasResults) return false;
  if ((property === "minPressure" || property === "maxPressure") && !isEps)
    return false;
  if (property === "waterAge") return reader?.qualityType === "age";
  if (property === "waterTrace")
    return hasResults && reader?.qualityType === "trace";
  if (property === "chemicalConcentration")
    return hasResults && reader?.qualityType === "chemical";
  return true;
};

export const withUnavailableColorRulesDropped = (
  symbology: SymbologySpec,
  simulation: SimulationState,
): SymbologySpec => {
  const dropNode =
    !!symbology.node.colorRule &&
    !isColorPropertyAvailable(symbology.node.colorRule.property, simulation);
  const dropLink =
    !!symbology.link.colorRule &&
    !isColorPropertyAvailable(symbology.link.colorRule.property, simulation);
  if (!dropNode && !dropLink) return symbology;
  return {
    ...symbology,
    node: dropNode ? { ...symbology.node, colorRule: null } : symbology.node,
    link: dropLink ? { ...symbology.link, colorRule: null } : symbology.link,
  };
};
