import { HydraulicModel, Junction, Pipe, Reservoir } from "src/hydraulic-model";
import { captureError } from "src/infra/error-tracking";
import { withInstrumentation } from "src/infra/with-instrumentation";

type SimulationPipeStatus = "Open" | "Closed";

type BuildOptions = {
  geolocation?: boolean;
};

export type EpanetUnitSystem =
  | "LPS"
  | "GPM"
  | "CFS"
  | "LPM"
  | "MGD"
  | "MLD"
  | "IMGD"
  | "CMH"
  | "AFD"
  | "CMD";

export const defaultAccuracy = 0.001;
export const defaultUnbalanced = "CONTINUE 10";

const chooseUnitSystem = (units: HydraulicModel["units"]): EpanetUnitSystem => {
  const flowUnit = units.flow;
  if (flowUnit === "l/s") return "LPS";
  if (flowUnit === "gal/min") return "GPM";
  if (flowUnit === "ft^3/s") return "CFS";
  if (flowUnit === "l/min") return "LPM";
  if (flowUnit === "Mgal/d") return "MGD";
  if (flowUnit === "IMgal/d") return "IMGD";
  if (flowUnit === "Ml/d") return "MLD";
  if (flowUnit === "m^3/h") return "CMH";
  if (flowUnit === "acft/d") return "AFD";
  if (flowUnit === "m^3/d") return "CMD";

  captureError(
    new Error(`Flow unit not supported ${flowUnit}, fallback to default`),
  );
  return "LPS";
};

export const buildInp = withInstrumentation(
  (
    hydraulicModel: HydraulicModel,
    { geolocation = false }: BuildOptions = {},
  ): string => {
    const units = chooseUnitSystem(hydraulicModel.units);
    const headlossFormula = hydraulicModel.headlossFormula;
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
        `Unbalanced\t${defaultUnbalanced}`,
        `Accuracy\t${defaultAccuracy}`,
        `Units\t${units}`,
        `Headloss\t${headlossFormula}`,
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
  },
  { name: "BUILD_INP", maxDurationMs: 1000 },
);

const pipeStatusFor = (pipe: Pipe): SimulationPipeStatus => {
  switch (pipe.status) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
  }
};
