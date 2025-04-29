import {
  HydraulicModel,
  LinkAsset,
  NodeAsset,
  Junction,
  Pipe,
  Reservoir,
  Pump,
} from "src/hydraulic-model";
import { Valve } from "src/hydraulic-model/asset-types";
import { checksum } from "src/infra/checksum";
import { captureError } from "src/infra/error-tracking";
import { withInstrumentation } from "src/infra/with-instrumentation";

type SimulationPipeStatus = "Open" | "Closed";
type SimulationPumpStatus = "Open" | "Closed";
type SimulationValveStatus = "Open" | "Closed";
type EpanetValveType = "TCV" | "PRV" | "PSV" | "PBV" | "FCV";

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
        return id;
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

type InpSections = {
  junctions: string[];
  reservoirs: string[];
  pipes: string[];
  pumps: string[];
  valves: string[];
  demands: string[];
  times: string[];
  report: string[];
  status: string[];
  curves: string[];
  options: string[];
  backdrop: string[];
  coordinates: string[];
  vertices: string[];
};

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
    const sections: InpSections = {
      junctions: ["[JUNCTIONS]", ";Id\tElevation"],
      reservoirs: ["[RESERVOIRS]", ";Id\tHead\tPattern"],
      pipes: [
        "[PIPES]",
        ";Id\tStart\tEnd\tLength\tDiameter\tRoughness\tMinorLoss\tStatus",
      ],
      pumps: ["[PUMPS]", ";Id\tStart\tEnd\tProperties"],
      valves: ["[VALVES]", ";Id\tStart\tEnd\tDiameter\tSetting\tMinorLoss"],
      demands: ["[DEMANDS]", ";Id\tDemand\tPattern\tCategory"],
      times: ["[TIMES]", `Duration\t${oneStep}`],
      report: ["[REPORT]", "Status\tFULL", "Summary\tNo", "Page\t0"],
      status: ["[STATUS]", ";Id\tStatus"],
      curves: ["[CURVES]", ";Id\tX\tY"],
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
        appendPipe(sections, idMap, hydraulicModel, geolocation, asset as Pipe);
      }

      if (asset.type === "pump") {
        appendPump(sections, idMap, hydraulicModel, geolocation, asset as Pump);
      }

      if (asset.type === "valve") {
        appendValve(
          sections,
          idMap,
          hydraulicModel,
          geolocation,
          asset as Valve,
        );
      }
    }

    let content = [
      sections.junctions.join("\n"),
      sections.reservoirs.join("\n"),
      sections.pipes.join("\n"),
      sections.pumps.join("\n"),
      sections.valves.join("\n"),
      sections.demands.join("\n"),
      sections.status.join("\n"),
      sections.curves.join("\n"),
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

const appendPipe = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  geolocation: boolean,
  pipe: Pipe,
) => {
  const linkId = idMap.linkId(pipe);
  const [startId, endId] = getLinkConnectionIds(hydraulicModel, idMap, pipe);
  sections.pipes.push(
    [
      linkId,
      startId,
      endId,
      pipe.length,
      pipe.diameter,
      pipe.roughness,
      pipe.minorLoss,
      pipeStatusFor(pipe),
    ].join("\t"),
  );
  if (geolocation) {
    appendLinkVertices(sections, idMap, pipe);
  }
};

const appendPump = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  geolocation: boolean,
  pump: Pump,
) => {
  const linkId = idMap.linkId(pump);
  const [startId, endId] = getLinkConnectionIds(hydraulicModel, idMap, pump);
  if (pump.definitionType === "flow-vs-head") {
    sections.pumps.push(
      [linkId, startId, endId, `HEAD ${pump.id}`, `SPEED ${pump.speed}`].join(
        "\t",
      ),
    );
    sections.curves.push(
      [pump.id, String(pump.designFlow), String(pump.designHead)].join("\t"),
    );
  } else {
    sections.pumps.push(
      [
        linkId,
        startId,
        endId,
        `POWER ${pump.power}`,
        `SPEED ${pump.speed}`,
      ].join("\t"),
    );
  }

  sections.status.push([linkId, pumpStatusFor(pump)].join("\t"));
  if (geolocation) {
    appendLinkVertices(sections, idMap, pump);
  }
};

const appendValve = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  geolocation: boolean,
  valve: Valve,
) => {
  const linkId = idMap.linkId(valve);
  sections.valves.push(
    [
      linkId,
      ...getLinkConnectionIds(hydraulicModel, idMap, valve),
      String(valve.diameter),
      valveTypeFor(valve),
      String(valve.setting),
      String(valve.minorLoss),
    ].join("\t"),
  );

  if (valve.initialStatus !== "active") {
    const fixedStatus = valveFixedStatusFor(valve);
    sections.status.push([linkId, fixedStatus].join("\t"));
  }

  if (geolocation) {
    appendLinkVertices(sections, idMap, valve);
  }
};

const getLinkConnectionIds = (
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  link: LinkAsset,
) => {
  const [nodeStart, nodeEnd] = link.connections;
  const startNodeId = idMap.nodeId(
    hydraulicModel.assets.get(nodeStart) as NodeAsset,
  );
  const endNodeId = idMap.nodeId(
    hydraulicModel.assets.get(nodeEnd) as NodeAsset,
  );

  return [startNodeId, endNodeId];
};

const appendLinkVertices = (
  sections: InpSections,
  idMap: EpanetIds,
  link: LinkAsset,
) => {
  for (const vertex of link.intermediateVertices) {
    sections.vertices.push([idMap.linkId(link), ...vertex].join("\t"));
  }
};

const pipeStatusFor = (pipe: Pipe): SimulationPipeStatus => {
  switch (pipe.status) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
  }
};

const pumpStatusFor = (pump: Pump): SimulationPumpStatus | number => {
  if (pump.initialStatus === "off" || pump.speed === 0) return "Closed";

  if (pump.speed !== 1) return pump.speed;

  return "Open";
};

const valveFixedStatusFor = (valve: Valve): SimulationValveStatus => {
  switch (valve.initialStatus) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
    case "active":
      throw new Error("Cannot force valve to active");
  }
};

const valveTypeFor = (valve: Valve): EpanetValveType => {
  return valve.valveType.toUpperCase() as EpanetValveType;
};
