import { HydraulicModel, Junction, Pipe, Reservoir } from "src/hydraulic-model";
import {
  AssetQuantitiesSpecByType,
  getQuantityUnit,
} from "src/hydraulic-model/asset-types";
import { captureWarning } from "src/infra/error-tracking";
import { isFeatureOn } from "src/infra/feature-flags";

type SimulationPipeStatus = "Open" | "Closed";

type BuildOptions = {
  geolocation?: boolean;
};

type EpanetUnitSystem = "LPS" | "GPM";

const chooseUnitSystem = (
  quantitiesSpec: AssetQuantitiesSpecByType,
): EpanetUnitSystem => {
  const pipeFlowUnit = getQuantityUnit(quantitiesSpec, "pipe", "flow");
  if (pipeFlowUnit === "l/s") return "LPS";
  if (pipeFlowUnit === "gal/min") return "GPM";

  captureWarning(
    `Flow unit not supported ${pipeFlowUnit}, fallback to default`,
  );
  return "LPS";
};

export const buildInp = (
  hydraulicModel: HydraulicModel,
  { geolocation = false }: BuildOptions = {},
): string => {
  const defaultUnits = isFeatureOn("FLAG_MODEL_UNITS")
    ? chooseUnitSystem(hydraulicModel.quantitiesSpec)
    : "LPS";
  const defaultHeadloss = "H-W";
  const oneStep = 0;
  const sections = {
    junctions: ["[JUNCTIONS]", ";Id\tElevation"],
    reservoirs: ["[RESERVOIRS]", ";Id\tHead\tPattern"],
    pipes: [
      "[PIPES]",
      ";Id\tStart\tEnd\tLength\tDiameter\tRoughness\tMinorLoss\tStatus",
    ],
    demands: ["[DEMANDS]", ";Id\tDemand\tPattern\tCategory"],
    times: ["[TIMES]", `Duration\t${oneStep}`],
    report: ["[REPORT]", "Status\tFULL", "Summary\tNo", "Page\t0"],
    options: [
      "[OPTIONS]",
      "Quality\tNONE",
      "Unbalanced\tCONTINUE 10",
      "Accuracy\t0.01",
      `Units\t${defaultUnits}`,
      `Headloss\t${defaultHeadloss}`,
    ],
    coordinates: ["[COORDINATES]", ";Node\tX-coord\tY-coord"],
    vertices: ["[VERTICES]", ";link\tX-coord\tY-coord"],
  };

  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type === "reservoir") {
      const reservoir = asset as Reservoir;
      sections.reservoirs.push([reservoir.id, reservoir.head].join("\t"));
      if (geolocation) {
        sections.coordinates.push(
          [reservoir.id, ...reservoir.coordinates].join("\t"),
        );
      }
    }
    if (asset.type === "junction") {
      const junction = asset as Junction;
      sections.junctions.push([junction.id, junction.elevation].join("\t"));
      sections.demands.push([junction.id, junction.demand].join("\t"));
      if (geolocation) {
        sections.coordinates.push(
          [junction.id, ...junction.coordinates].join("\t"),
        );
      }
    }
    if (asset.type === "pipe") {
      const pipe = asset as Pipe;
      const [nodeStart, nodeEnd] = pipe.connections;
      sections.pipes.push(
        [
          pipe.id,
          nodeStart,
          nodeEnd,
          pipe.length,
          pipe.diameter,
          pipe.roughness,
          pipe.minorLoss,
          pipeStatusFor(pipe),
        ].join("\t"),
      );
      if (geolocation) {
        for (const vertex of pipe.intermediateVertices) {
          sections.vertices.push([pipe.id, ...vertex].join("\t"));
        }
      }
    }
  }

  return [
    sections.junctions.join("\n"),
    sections.reservoirs.join("\n"),
    sections.pipes.join("\n"),
    sections.demands.join("\n"),
    sections.times.join("\n"),
    sections.report.join("\n"),
    sections.options.join("\n"),
    geolocation && sections.coordinates.join("\n"),
    geolocation && sections.vertices.join("\n"),
    "[END]",
  ]
    .filter((f) => !!f)
    .join("\n\n");
};

const pipeStatusFor = (pipe: Pipe): SimulationPipeStatus => {
  switch (pipe.status) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
  }
};
