import {
  HydraulicModel,
  LinkAsset,
  NodeAsset,
  Junction,
  Pipe,
  Reservoir,
  Pump,
  Tank,
  EPSTiming,
} from "src/hydraulic-model";
import {
  CustomerPoint,
  getActiveCustomerPoints,
} from "src/hydraulic-model/customer-points";
import { CustomerPointsLookup } from "src/hydraulic-model/customer-points-lookup";
import { Valve, AssetId } from "src/hydraulic-model/asset-types";
import { checksum } from "src/infra/checksum";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import {
  formatSimpleControl,
  formatRuleBasedControl,
  IdResolver,
} from "src/hydraulic-model/controls";

type SimulationPipeStatus = "Open" | "Closed" | "CV";
type SimulationPumpStatus = "Open" | "Closed";
type SimulationValveStatus = "Open" | "Closed";
type EpanetValveType = "TCV" | "PRV" | "PSV" | "PBV" | "FCV";

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
export const defaultCustomersPatternId = "epanetjs_customers";

const formatSecondsToTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (secs > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  if (minutes > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}`;
  }
  return `${hours}`;
};

const buildTimesSection = (epsTiming: EPSTiming): string[] => {
  const section = ["[TIMES]"];

  const duration = epsTiming.duration ?? 0;
  section.push(`Duration\t${formatSecondsToTime(duration)}`);

  if (epsTiming.hydraulicTimestep !== undefined) {
    section.push(
      `Hydraulic Timestep\t${formatSecondsToTime(epsTiming.hydraulicTimestep)}`,
    );
  }

  if (epsTiming.reportTimestep !== undefined) {
    section.push(
      `Report Timestep\t${formatSecondsToTime(epsTiming.reportTimestep)}`,
    );
  }

  if (epsTiming.patternTimestep !== undefined) {
    section.push(
      `Pattern Timestep\t${formatSecondsToTime(epsTiming.patternTimestep)}`,
    );
  }

  return section;
};

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

  throw new Error(`Flow unit not supported ${flowUnit}`);
};

class EpanetIds {
  private strategy: "id" | "label";
  private assetIds: Map<AssetId, string>;
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
        return String(link.id);
      case "label":
        if (this.assetIds.has(link.id)) return this.assetIds.get(link.id)!;
        const id = this.ensureUnique(this.linkIds, link.label);
        this.linkIds.add(id);
        this.assetIds.set(link.id, id);
        return id;
    }
  }

  nodeId(node: NodeAsset) {
    switch (this.strategy) {
      case "id":
        return String(node.id);
      case "label":
        if (this.assetIds.has(node.id)) return this.assetIds.get(node.id)!;
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
  tanks: string[];
  pipes: string[];
  pumps: string[];
  valves: string[];
  demands: string[];
  times: string[];
  report: string[];
  status: string[];
  curves: string[];
  patterns: string[];
  options: string[];
  backdrop: string[];
  coordinates: string[];
  vertices: string[];
  customers: string[];
  controls: string[];
  rules: string[];
};

type BuildOptions = {
  geolocation?: boolean;
  madeBy?: boolean;
  labelIds?: boolean;
  customerDemands?: boolean;
  customerPoints?: boolean;
  inactiveAssets?: boolean;
};

export const buildInp = withDebugInstrumentation(
  (hydraulicModel: HydraulicModel, options: BuildOptions = {}): string => {
    const defaultOptions: Required<BuildOptions> = {
      geolocation: false,
      madeBy: false,
      labelIds: false,
      customerDemands: false,
      customerPoints: false,
      inactiveAssets: false,
    };
    const opts = { ...defaultOptions, ...options };
    const idMap = new EpanetIds({ strategy: opts.labelIds ? "label" : "id" });
    const units = chooseUnitSystem(hydraulicModel.units);
    const headlossFormula = hydraulicModel.headlossFormula;
    const constantPatternId = getConstantPatternId(
      new Set(hydraulicModel.demands.patterns.keys()),
    );
    const sections: InpSections = {
      junctions: ["[JUNCTIONS]", ";Id\tElevation"],
      reservoirs: ["[RESERVOIRS]", ";Id\tHead\tPattern"],
      tanks: [
        "[TANKS]",
        ";Id\tElevation\tInitLevel\tMinLevel\tMaxLevel\tDiameter\tMinVol",
      ],
      pipes: [
        "[PIPES]",
        ";Id\tStart\tEnd\tLength\tDiameter\tRoughness\tMinorLoss\tStatus",
      ],
      pumps: ["[PUMPS]", ";Id\tStart\tEnd\tProperties"],
      valves: ["[VALVES]", ";Id\tStart\tEnd\tDiameter\tSetting\tMinorLoss"],
      demands: ["[DEMANDS]", ";Id\tDemand\tPattern\tCategory"],
      times: buildTimesSection(hydraulicModel.epsTiming),
      report: ["[REPORT]", "Status\tFULL", "Summary\tNo", "Page\t0"],
      status: ["[STATUS]", ";Id\tStatus"],
      curves: ["[CURVES]", ";Id\tX\tY"],
      patterns: ["[PATTERNS]", ";Id\tMultiplier"],
      options: [
        "[OPTIONS]",
        "Quality\tNONE",
        `Unbalanced\t${defaultUnbalanced}`,
        `Accuracy\t${defaultAccuracy}`,
        `Units\t${units}`,
        `Headloss\t${headlossFormula}`,
        `Demand Multiplier\t${hydraulicModel.demands.multiplier}`,
        `Pattern\t${constantPatternId}`,
      ],
      backdrop: ["[BACKDROP]", "Units\tDEGREES"],
      coordinates: ["[COORDINATES]", ";Node\tX-coord\tY-coord"],
      vertices: ["[VERTICES]", ";link\tX-coord\tY-coord"],
      customers: [
        ";[CUSTOMERS]",
        ";Id\tX-coord\tY-coord\tBaseDemand\tPipeId\tJunctionId\tSnapX\tSnapY",
      ],
      controls: ["[CONTROLS]"],
      rules: ["[RULES]"],
    };

    const usedPatternIds = new Set<string>();

    for (const asset of hydraulicModel.assets.values()) {
      if (asset.type === "reservoir") {
        appendReservoir(
          sections,
          idMap,
          opts.geolocation,
          opts.inactiveAssets,
          asset as Reservoir,
        );
      }

      if (asset.type === "tank") {
        appendTank(
          sections,
          idMap,
          opts.geolocation,
          opts.inactiveAssets,
          asset as Tank,
        );
      }

      if (asset.type === "junction") {
        appendJunction(
          sections,
          idMap,
          opts.geolocation,
          opts.customerDemands,
          opts.inactiveAssets,
          asset as Junction,
          hydraulicModel.customerPointsLookup,
          hydraulicModel.assets,
          usedPatternIds,
        );
      }

      if (asset.type === "pipe") {
        appendPipe(
          sections,
          idMap,
          hydraulicModel,
          opts.geolocation,
          opts.inactiveAssets,
          asset as Pipe,
        );
      }

      if (asset.type === "pump") {
        appendPump(
          sections,
          idMap,
          hydraulicModel,
          opts.geolocation,
          opts.inactiveAssets,
          asset as Pump,
        );
      }

      if (asset.type === "valve") {
        appendValve(
          sections,
          idMap,
          hydraulicModel,
          opts.geolocation,
          opts.inactiveAssets,
          asset as Valve,
        );
      }
    }

    if (opts.customerPoints) {
      for (const customerPoint of hydraulicModel.customerPoints.values()) {
        appendCustomerPoint(sections, idMap, hydraulicModel, customerPoint);
      }
    }

    const includeCustomerPoints =
      opts.customerPoints && hydraulicModel.customerPoints.size > 0;

    appendDemandPatterns(
      sections,
      constantPatternId,
      hydraulicModel.demands.patterns,
      usedPatternIds,
    );

    appendControls(sections, hydraulicModel.controls, idMap, hydraulicModel);

    const hasControls = sections.controls.length > 1;
    const hasRules = sections.rules.length > 1;

    let content = [
      sections.junctions.join("\n"),
      sections.reservoirs.join("\n"),
      sections.tanks.join("\n"),
      sections.pipes.join("\n"),
      sections.pumps.join("\n"),
      sections.valves.join("\n"),
      sections.demands.join("\n"),
      sections.status.join("\n"),
      sections.curves.join("\n"),
      sections.patterns.join("\n"),
      sections.times.join("\n"),
      sections.report.join("\n"),
      sections.options.join("\n"),
      opts.geolocation && sections.backdrop.join("\n"),
      opts.geolocation && sections.coordinates.join("\n"),
      opts.geolocation && sections.vertices.join("\n"),
      includeCustomerPoints && sections.customers.join("\n"),
      hasControls && sections.controls.join("\n"),
      hasRules && sections.rules.join("\n"),
      "[END]",
    ]
      .filter((f) => !!f)
      .join("\n\n");

    if (opts.madeBy) {
      content = `;MADE BY EPANET-JS [${checksum(content)}]\n` + content;
    }
    return content;
  },
  { name: "BUILD_INP", maxDurationMs: 1000 },
);

const appendReservoir = (
  sections: InpSections,
  idMap: EpanetIds,
  geolocation: boolean,
  inactiveAssets: boolean,
  reservoir: Reservoir,
) => {
  if (!reservoir.isActive && !inactiveAssets) {
    return;
  }

  const reservoirId = idMap.nodeId(reservoir);
  const commentPrefix = !reservoir.isActive ? ";" : "";

  sections.reservoirs.push(
    commentPrefix + [reservoirId, reservoir.head].join("\t"),
  );
  if (geolocation) {
    appendNodeCoordinates(sections, idMap, reservoir, commentPrefix);
  }
};

const appendTank = (
  sections: InpSections,
  idMap: EpanetIds,
  geolocation: boolean,
  inactiveAssets: boolean,
  tank: Tank,
) => {
  if (!tank.isActive && !inactiveAssets) {
    return;
  }

  const tankId = idMap.nodeId(tank);
  const nullCurveId = "*";
  const commentPrefix = !tank.isActive ? ";" : "";

  sections.tanks.push(
    commentPrefix +
      [
        tankId,
        tank.elevation,
        tank.initialLevel,
        tank.minLevel,
        tank.maxLevel,
        tank.diameter,
        tank.minVolume,
        nullCurveId,
        tank.overflow ? "YES" : "NO",
      ].join("\t"),
  );
  if (geolocation) {
    appendNodeCoordinates(sections, idMap, tank, commentPrefix);
  }
};

const appendJunction = (
  sections: InpSections,
  idMap: EpanetIds,
  geolocation: boolean,
  customerDemands: boolean,
  inactiveAssets: boolean,
  junction: Junction,
  customerPointsLookup: CustomerPointsLookup,
  assets: HydraulicModel["assets"],
  usedPatternIds: Set<string>,
) => {
  if (!junction.isActive && !inactiveAssets) {
    return;
  }

  const junctionId = idMap.nodeId(junction);
  const commentPrefix = !junction.isActive ? ";" : "";

  sections.junctions.push(
    commentPrefix + [junctionId, junction.elevation].join("\t"),
  );

  for (const demand of junction.demands) {
    if (demand.baseDemand === 0) continue;

    const demandLine = demand.patternId
      ? [junctionId, demand.baseDemand, demand.patternId]
      : [junctionId, demand.baseDemand];

    sections.demands.push(commentPrefix + demandLine.join("\t"));

    if (demand.patternId) {
      usedPatternIds.add(demand.patternId);
    }
  }

  if (customerDemands) {
    const customerPoints = getActiveCustomerPoints(
      customerPointsLookup,
      assets,
      junction.id,
    );
    const totalCustomerDemand = customerPoints.reduce(
      (sum, cp) => sum + cp.baseDemand,
      0,
    );
    if (totalCustomerDemand > 0) {
      sections.demands.push(
        commentPrefix +
          [junctionId, totalCustomerDemand, defaultCustomersPatternId].join(
            "\t",
          ),
      );
      usedPatternIds.add(defaultCustomersPatternId);
    }
  }

  if (geolocation) {
    appendNodeCoordinates(sections, idMap, junction, commentPrefix);
  }
};

const appendPipe = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  geolocation: boolean,
  inactiveAssets: boolean,
  pipe: Pipe,
) => {
  if (!pipe.isActive && !inactiveAssets) {
    return;
  }

  const linkId = idMap.linkId(pipe);
  const [startId, endId] = getLinkConnectionIds(hydraulicModel, idMap, pipe);
  const commentPrefix = !pipe.isActive ? ";" : "";

  sections.pipes.push(
    commentPrefix +
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
    appendLinkVertices(sections, idMap, pipe, commentPrefix);
  }
};

const appendPump = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  geolocation: boolean,
  inactiveAssets: boolean,
  pump: Pump,
) => {
  if (!pump.isActive && !inactiveAssets) {
    return;
  }

  const linkId = idMap.linkId(pump);
  const [startId, endId] = getLinkConnectionIds(hydraulicModel, idMap, pump);
  const commentPrefix = !pump.isActive ? ";" : "";

  if (
    pump.definitionType === "design-point" ||
    pump.definitionType === "standard"
  ) {
    const curve = hydraulicModel.curves.get(pump.curveId!);

    sections.pumps.push(
      commentPrefix +
        [linkId, startId, endId, `HEAD ${pump.id}`, `SPEED ${pump.speed}`].join(
          "\t",
        ),
    );

    for (const point of curve!.points) {
      sections.curves.push(
        commentPrefix + [pump.id, String(point.x), String(point.y)].join("\t"),
      );
    }
  } else {
    sections.pumps.push(
      commentPrefix +
        [
          linkId,
          startId,
          endId,
          `POWER ${pump.power}`,
          `SPEED ${pump.speed}`,
        ].join("\t"),
    );
  }

  sections.status.push(
    commentPrefix + [linkId, pumpStatusFor(pump)].join("\t"),
  );
  if (geolocation) {
    appendLinkVertices(sections, idMap, pump, commentPrefix);
  }
};

const appendValve = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  geolocation: boolean,
  inactiveAssets: boolean,
  valve: Valve,
) => {
  if (!valve.isActive && !inactiveAssets) {
    return;
  }

  const linkId = idMap.linkId(valve);
  const commentPrefix = !valve.isActive ? ";" : "";

  sections.valves.push(
    commentPrefix +
      [
        linkId,
        ...getLinkConnectionIds(hydraulicModel, idMap, valve),
        String(valve.diameter),
        kindFor(valve),
        String(valve.setting),
        String(valve.minorLoss),
      ].join("\t"),
  );

  if (valve.initialStatus !== "active") {
    const fixedStatus = valveFixedStatusFor(valve);
    sections.status.push(commentPrefix + [linkId, fixedStatus].join("\t"));
  }

  if (geolocation) {
    appendLinkVertices(sections, idMap, valve, commentPrefix);
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

const appendNodeCoordinates = (
  sections: InpSections,
  idMap: EpanetIds,
  node: NodeAsset,
  commentPrefix = "",
) => {
  sections.coordinates.push(
    commentPrefix + [idMap.nodeId(node), ...node.coordinates].join("\t"),
  );
};

const appendLinkVertices = (
  sections: InpSections,
  idMap: EpanetIds,
  link: LinkAsset,
  commentPrefix = "",
) => {
  for (const vertex of link.intermediateVertices) {
    sections.vertices.push(
      commentPrefix + [idMap.linkId(link), ...vertex].join("\t"),
    );
  }
};

const pipeStatusFor = (pipe: Pipe): SimulationPipeStatus => {
  switch (pipe.initialStatus) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
    case "cv":
      return "CV";
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

const kindFor = (valve: Valve): EpanetValveType => {
  return valve.kind.toUpperCase() as EpanetValveType;
};

const getConstantPatternId = (usedPatternIds: Set<string>): string => {
  const base = "CONSTANT";
  if (!usedPatternIds.has(base)) return base;

  let count = 1;
  while (usedPatternIds.has(`${base}_${count}`)) {
    count++;
  }
  return `${base}_${count}`;
};

const appendControls = (
  sections: InpSections,
  controls: HydraulicModel["controls"],
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
) => {
  const idResolver: IdResolver = (assetId: AssetId) => {
    const asset = hydraulicModel.assets.get(assetId);
    if (!asset) {
      return String(assetId);
    }
    if (asset.isLink) {
      return idMap.linkId(asset as LinkAsset);
    } else {
      return idMap.nodeId(asset as NodeAsset);
    }
  };

  for (const control of controls.simple) {
    sections.controls.push(formatSimpleControl(control, idResolver));
  }

  for (const rule of controls.rules) {
    sections.rules.push(formatRuleBasedControl(rule, idResolver));
  }
};

const appendDemandPatterns = (
  sections: InpSections,
  constantPatternId: string,
  patterns: Map<string, number[]>,
  usedPatternIds: Set<string>,
) => {
  sections.patterns.push([constantPatternId, "1"].join("\t"));

  for (const [patternId, factors] of patterns) {
    if (!usedPatternIds.has(patternId)) continue;

    const FACTORS_PER_LINE = 8;
    for (let i = 0; i < factors.length; i += FACTORS_PER_LINE) {
      const chunk = factors.slice(i, i + FACTORS_PER_LINE);
      sections.patterns.push([patternId, ...chunk.map(String)].join("\t"));
    }
  }

  if (usedPatternIds.has(defaultCustomersPatternId)) {
    sections.patterns.push([defaultCustomersPatternId, "1"].join("\t"));
  }
};

const appendCustomerPoint = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  customerPoint: CustomerPoint,
) => {
  const connection = customerPoint.connection;
  const [x, y] = customerPoint.coordinates;
  const baseDemand = customerPoint.baseDemand;

  if (connection) {
    const [snapX, snapY] = connection.snapPoint;

    const junction = hydraulicModel.assets.get(
      connection.junctionId,
    ) as Junction;
    const pipe = hydraulicModel.assets.get(connection.pipeId) as LinkAsset;
    sections.customers.push(
      ";" +
        [
          customerPoint.label,
          x,
          y,
          baseDemand,
          idMap.linkId(pipe),
          idMap.nodeId(junction),
          snapX,
          snapY,
        ].join("\t"),
    );
  } else {
    sections.customers.push(
      ";" + [customerPoint.label, x, y, baseDemand, "", "", "", ""].join("\t"),
    );
  }
};
