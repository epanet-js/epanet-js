import {
  HydraulicModel,
  LinkAsset,
  NodeAsset,
  Junction,
  Pipe,
  Reservoir,
} from "src/hydraulic-model";
import { checksum } from "src/infra/checksum";
import { captureError } from "src/infra/error-tracking";
import { withInstrumentation } from "src/infra/with-instrumentation";

type SimulationPipeStatus = "Open" | "Closed";

type BuildOptions = {
  geolocation?: boolean;
  madeBy?: boolean;
  labelIds?: boolean;
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

class EpanetIds {
  private strategy: "id" | "label";
  private assetIds: Map<string, string>;
  private linkIds: Set<string>;
  private nodeIds: Set<string>;

  constructor({ strategy }: { strategy: "id" | "label" }) {
    this.strategy = strategy;
    this.nodeIds = new Set();
    this.linkIds = new Set();
    this.assetIds = new Map();
  }

  linkId(link: LinkAsset) {
    switch (this.strategy) {
      case "id":
        return link.id;
      case "label":
        if (this.assetIds.has(link.id)) return this.assetIds.get(link.id);
        const id = this.ensureUnique(this.linkIds, link.label);
        this.linkIds.add(id);
        this.assetIds.set(link.id, id);
        return link.label;
    }
  }

  nodeId(node: NodeAsset) {
    switch (this.strategy) {
      case "id":
        return node.id;
      case "label":
        if (this.assetIds.has(node.id)) return this.assetIds.get(node.id);
        const id = this.ensureUnique(this.nodeIds, node.label);
        this.nodeIds.add(id);
        this.assetIds.set(node.id, id);
        return id;
    }
  }

  private ensureUnique(
    takenIds: Set<string>,
    candidate: string,
    count = 0,
  ): string {
    const newCandidate = count > 0 ? `${candidate}.${count}` : candidate;
    if (!takenIds.has(newCandidate)) {
      return newCandidate;
    } else {
      return this.ensureUnique(takenIds, candidate, count + 1);
    }
  }
}

export const buildInp = withInstrumentation(
  (
    hydraulicModel: HydraulicModel,
    {
      geolocation = false,
      madeBy = false,
      labelIds = false,
    }: BuildOptions = {},
  ): string => {
    const idMap = new EpanetIds({ strategy: labelIds ? "label" : "id" });
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
      backdrop: ["[BACKDROP]", "Units\tDEGREES"],
      coordinates: ["[COORDINATES]", ";Node\tX-coord\tY-coord"],
      vertices: ["[VERTICES]", ";link\tX-coord\tY-coord"],
    };

    for (const asset of hydraulicModel.assets.values()) {
      if (asset.type === "reservoir") {
        const reservoir = asset as Reservoir;
        const reservoirId = idMap.nodeId(reservoir);

        sections.reservoirs.push([reservoirId, reservoir.head].join("\t"));
        if (geolocation) {
          sections.coordinates.push(
            [reservoirId, ...reservoir.coordinates].join("\t"),
          );
        }
      }

      if (asset.type === "junction") {
        const junction = asset as Junction;
        const junctionId = idMap.nodeId(junction);

        sections.junctions.push([junctionId, junction.elevation].join("\t"));
        sections.demands.push([junctionId, junction.demand].join("\t"));
        if (geolocation) {
          sections.coordinates.push(
            [junctionId, ...junction.coordinates].join("\t"),
          );
        }
      }

      if (asset.type === "pipe") {
        const pipe = asset as Pipe;
        const [nodeStart, nodeEnd] = pipe.connections;
        sections.pipes.push(
          [
            idMap.linkId(pipe),
            idMap.nodeId(hydraulicModel.assets.get(nodeStart) as NodeAsset),
            idMap.nodeId(hydraulicModel.assets.get(nodeEnd) as NodeAsset),
            pipe.length,
            pipe.diameter,
            pipe.roughness,
            pipe.minorLoss,
            pipeStatusFor(pipe),
          ].join("\t"),
        );
        if (geolocation) {
          for (const vertex of pipe.intermediateVertices) {
            sections.vertices.push([idMap.linkId(pipe), ...vertex].join("\t"));
          }
        }
      }
    }

    let content = [
      sections.junctions.join("\n"),
      sections.reservoirs.join("\n"),
      sections.pipes.join("\n"),
      sections.demands.join("\n"),
      sections.times.join("\n"),
      sections.report.join("\n"),
      sections.options.join("\n"),
      geolocation && sections.backdrop.join("\n"),
      geolocation && sections.coordinates.join("\n"),
      geolocation && sections.vertices.join("\n"),
      "[END]",
    ]
      .filter((f) => !!f)
      .join("\n\n");

    if (madeBy) {
      content = `;MADE BY EPANET-JS [${checksum(content)}]\n` + content;
    }
    return content;
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
