import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, Section, TypeDef } from "../types";

const asset = propertyOf("Asset");
const node = propertyOf("NodeAsset");
const junction = propertyOf("Junction");
const reservoir = propertyOf("Reservoir");
const tank = propertyOf("Tank");
const link = propertyOf("LinkAsset");
const pipe = propertyOf("Pipe");
const pump = propertyOf("Pump");
const valve = propertyOf("Valve");
const customerPoint = propertyOf("CustomerPoint");

const QUALITY = `/** when the run had that water quality analysis */
  waterAge?: number;
  waterTrace?: number;
  chemicalConcentration?: number;`;

const QUALITY_SERIES = '"waterAge" | "waterTrace" | "chemicalConcentration"';

const STATUS_WARNING =
  'statusWarning: "cannot-deliver-flow" | "cannot-deliver-pressure" | "cannot-deliver-head" | null;';

const resultsType = (
  name: string,
  kind: string,
  values: string,
  series: string,
  runWide: string,
  summary: string,
): TypeDef => ({
  name,
  definition: `interface ${name} {
  ${values}
  ${QUALITY}
  /** this ${kind} at another timestep; a negative index counts from the end */
  at(index: number): ${name} | null;
  /** one value per entry of network.results.timesteps */
  series(property: ${series} | ${QUALITY_SERIES}): number[] | null;${runWide ? `\n  ${runWide}` : ""}
}`,
  summary,
});

const NODE_STATS =
  "/** lowest and highest over the run; the same at every timestep */\n  readonly stats: { minPressure: number; maxPressure: number; minHead: number; maxHead: number } | null;";

const RESULTS_TYPES: TypeDef[] = [
  resultsType(
    "JunctionResults",
    "junction",
    "pressure: number;\n  head: number;\n  demand: number;",
    '"pressure" | "head" | "demand"',
    NODE_STATS,
    "A junction's simulation results at one timestep.",
  ),
  resultsType(
    "ReservoirResults",
    "reservoir",
    "pressure: number;\n  head: number;\n  netFlow: number;",
    '"pressure" | "head" | "netFlow"',
    NODE_STATS,
    "A reservoir's simulation results at one timestep.",
  ),
  resultsType(
    "TankResults",
    "tank",
    "pressure: number;\n  head: number;\n  level: number;\n  volume: number;\n  netFlow: number;",
    '"pressure" | "head" | "level" | "volume" | "netFlow"',
    NODE_STATS,
    "A tank's simulation results at one timestep.",
  ),
  resultsType(
    "PipeResults",
    "pipe",
    'flow: number;\n  velocity: number;\n  headloss: number;\n  unitHeadloss: number;\n  status: "open" | "closed";',
    '"flow" | "velocity" | "headloss" | "unitHeadloss"',
    "",
    "A pipe's simulation results at one timestep.",
  ),
  resultsType(
    "PumpResults",
    "pump",
    `flow: number;\n  head: number;\n  status: "on" | "off";\n  ${STATUS_WARNING}`,
    '"flow" | "head" | "setting"',
    "/** energy use over the run, as EPANET reports it; the same at every timestep */\n  readonly energy: { utilization: number; averageEfficiency: number; averageKwPerFlowUnit: number; averageKw: number; peakKw: number; averageCostPerDay: number; demandCharge: number } | null;",
    "A pump's simulation results at one timestep.",
  ),
  resultsType(
    "ValveResults",
    "valve",
    `flow: number;\n  velocity: number;\n  headloss: number;\n  status: "active" | "open" | "closed";\n  ${STATUS_WARNING}`,
    '"flow" | "velocity" | "headloss" | "setting"',
    "",
    "A valve's simulation results at one timestep.",
  ),
];

const STATS_UNITS =
  "`stats` is in `units.pressure` and `units.head`. The engine tracks it at every hydraulic step, including the ones between reported timesteps — when a control fires or a tank fills — so it can be beyond anything `series` shows.";

const FLOW_DIRECTION =
  "A positive `flow` runs from the start node to the end node.";

const resultsOf = (
  owner: string,
  kind: string,
  units: string,
  code: string,
): Member =>
  memberOf(owner)({
    name: "results",
    signature: `readonly results: ${owner}Results | null`,
    summary: `This ${kind}'s simulation results at the timestep the user had selected in the app when the script started.`,
    description: `\`at\` reads another timestep and \`series\` one property across the run. \`null\` when there is no simulation, the run has no timesteps, or it did not include this ${kind} — inactive, or added since. Check \`network.results.isStale\` before trusting the numbers. ${units}`,
    throws: [
      "`at` with an index outside the run",
      "`series` with a property it does not list",
      "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
    ],
    examples: [{ code }],
  });

const junctionResults = resultsOf(
  "Junction",
  "junction",
  `Values are in \`network.units[name]\`, except \`demand\`, which is in \`units.actualDemand\`. ${STATS_UNITS}`,
  `const low = network.junctions.filter((junction) => junction.results?.pressure < 20);
console.log(low.length, "junctions below 20", network.units.pressure, "at the selected timestep");
const j1 = network.getNode("J1").results;
if (j1) console.log("J1:", j1.pressure, "now,", j1.at(-1).pressure, "at the end,", j1.stats.minPressure, "at its lowest");`,
);

const reservoirResults = resultsOf(
  "Reservoir",
  "reservoir",
  `Values are in \`network.units[name]\`. ${STATS_UNITS}`,
  `for (const reservoir of network.reservoirs) {
  console.log(reservoir.label, reservoir.results?.netFlow, network.units.netFlow);
}`,
);

const tankResults = resultsOf(
  "Tank",
  "tank",
  `Values are in \`network.units[name]\`. ${STATS_UNITS}`,
  `for (const tank of network.tanks) {
  const levels = tank.results?.series("level") ?? [];
  console.log(tank.label, "runs from", Math.min(...levels), "to", Math.max(...levels), network.units.level);
}`,
);

const pipeResults = resultsOf(
  "Pipe",
  "pipe",
  `Values are in \`network.units[name]\`. ${FLOW_DIRECTION}`,
  `const closed = network.pipes.filter((pipe) => pipe.results?.status === "closed");
console.log(closed.length, "pipes closed at the selected timestep");
const flows = network.getLink("P1").results?.series("flow") ?? [];
console.log("P1 peaks at", Math.max(...flows.map(Math.abs)), network.units.flow);`,
);

const pumpResults = resultsOf(
  "Pump",
  "pump",
  `Values are in \`network.units[name]\`, except \`head\`, which is in \`units.actualHead\`. \`series("setting")\` is the relative speed the engine ran the pump at, like \`pump.speed\`. ${FLOW_DIRECTION} \`energy\` has \`utilization\` and \`averageEfficiency\` in \`units.efficiency\`, \`averageKw\` and \`peakKw\` in \`units.power\`, \`averageKwPerFlowUnit\` in \`units.averageKwPerFlowUnit\`; \`averageCostPerDay\` and \`demandCharge\` are in the project's currency. \`demandCharge\` is the network's, the same for every pump. \`energy\` is \`null\` when the run reported none.`,
  `for (const pump of network.pumps) {
  const energy = pump.results?.energy;
  if (energy) console.log(pump.label, pump.results.status, energy.averageKw, network.units.power, "on", energy.utilization, network.units.efficiency, "of the time");
}`,
);

const valveResults = resultsOf(
  "Valve",
  "valve",
  `Values are in \`network.units[name]\`. \`series("setting")\` is the setting the engine applied, in the unit its kind uses, like \`valve.setting\`. ${FLOW_DIRECTION}`,
  `const struggling = network.valves.filter((valve) => valve.results?.statusWarning);
console.log(struggling.map((valve) => \`\${valve.label}: \${valve.results.statusWarning}\`));`,
);

export const sectionFor = ({ results }: DocsCandidates): Section => ({
  id: "assets",
  number: "1.3",
  title: "Assets",
  intro:
    "Every asset is a read-only object of getters. A value the model has not set reads as `null`.",
  types: [
    {
      name: "AssetType",
      definition:
        'type AssetType = "junction" | "reservoir" | "tank" | "pipe" | "pump" | "valve";',
      summary: "The six asset types.",
    },
    {
      name: "Demand",
      definition: "interface Demand { base: number; pattern?: string }",
      summary:
        "One demand category: a base demand and the label of its pattern, absent when it has none.",
    },
    {
      name: "PumpControl",
      definition: `type PumpControl =
  | {
      type: "timed-setting";
      steps: { time: number; status: "on" | "off"; setting: number }[];
    }
  | {
      type: "level-setting";
      tank: Tank;
      on: { level: number; setting: number };
      off: { level: number };
    }
  | {
      type: "variable-speed-pump";
      quantity: "pressure" | "level" | "flow";
      targetAsset: Asset;
      target: number;
      minSpeed: number;
      maxSpeed: number;
      laggedPumps: Pump[];
      schedule: { time: number; target: number }[];
      tankLevels: { tank: Tank; onLevel: number; offLevel: number } | null;
    };`,
      summary:
        "A pump's structured control from the app. Times are in seconds.",
    },
    ...(results ? RESULTS_TYPES : []),
  ],
  members: [
    asset(
      "uid",
      "number",
      "An internal number. Never persist it; address assets by label.",
    ),
    asset(
      "label",
      "string",
      "The name shown in the app and written to INP files.",
    ),
    asset("type", "AssetType", "The asset's type."),
    asset("isNode", "boolean", "Whether it is a junction, reservoir or tank."),
    asset("isLink", "boolean", "Whether it is a pipe, pump or valve."),
    asset(
      "isActive",
      "boolean",
      "Whether it takes part in the simulation, the INP and the review checks.",
    ),
    asset(
      "isSelected",
      "boolean",
      "Whether it is in the user's selection, or the script's after `selection.set`.",
    ),
    asset(
      "geometry",
      "GeoJSON.Point | GeoJSON.LineString",
      "The asset's geometry.",
    ),
    memberOf("Asset")({
      name: "getCustom",
      signature: "getCustom(name: string): string | number | null",
      summary: "A custom attribute's value by its name, or `null`.",
      description:
        "`network.customAttributes(type)` lists the attributes defined for each type.",
    }),

    node("coordinates", "Position", "Where the node is."),
    node("elevation", "number | null", "The node's elevation."),
    node("initialQuality", "number | null", "The initial water quality."),
    node(
      "chemicalSourceType",
      '"concen" | "mass" | "flowpaced" | "setpoint" | null',
      "The kind of quality source at the node.",
    ),
    node(
      "chemicalSourceStrength",
      "number | null",
      "The quality source's strength.",
    ),
    node(
      "chemicalSourcePattern",
      "string | null",
      "The label of the quality source's pattern.",
    ),
    node("links", "LinkAsset[]", "The links connected to the node."),

    junction("emitterCoefficient", "number | null", "The emitter coefficient."),
    junction("demands", "Demand[]", "The demand categories."),
    junction(
      "baseDemand",
      "number",
      "The sum of the categories' `base`. Demand from customer points is not included.",
    ),
    junction(
      "customerPoints",
      "CustomerPoint[]",
      "The customer points allocated to the junction.",
    ),
    ...(results ? [junctionResults] : []),

    reservoir("head", "number | null", "The reservoir's head."),
    reservoir("headPattern", "string | null", "The label of the head pattern."),
    ...(results ? [reservoirResults] : []),

    tank("initialLevel", "number | null", "The initial level."),
    tank("minLevel", "number | null", "The minimum level."),
    tank("maxLevel", "number | null", "The maximum level."),
    tank(
      "diameter",
      "number | null",
      "The tank's diameter, in `units.tankDiameter`.",
    ),
    tank("minVolume", "number | null", "The minimum volume."),
    tank("overflow", "boolean", "Whether the tank can overflow."),
    tank(
      "mixingModel",
      '"mixed" | "2comp" | "fifo" | "lifo"',
      "The mixing model.",
    ),
    tank("mixingFraction", "number | null", "The mixing fraction."),
    tank(
      "bulkReactionCoeff",
      "number | null",
      "The bulk reaction coefficient.",
    ),
    tank("volumeCurve", "string | null", "The label of the volume curve."),
    ...(results ? [tankResults] : []),

    link(
      "startNode",
      "NodeAsset",
      "The start node. Positive flow runs start → end.",
    ),
    link("endNode", "NodeAsset", "The end node."),
    link("length", "number", "The stored length, in `units.length`."),
    link(
      "geometryLength",
      "number",
      "The length measured along the drawn line, in `units.length`.",
    ),
    link("vertices", "Position[]", "The intermediate points of the line."),
    memberOf("LinkAsset")({
      name: "pointAt",
      signature: "pointAt(distance: number): Position",
      summary: "The point that far along the line, in the project length unit.",
    }),

    pipe(
      "diameter",
      "number | null",
      "The pipe's diameter, in `units.diameter`.",
    ),
    pipe(
      "roughness",
      "number | null",
      "The pipe's own roughness, often `null`. Not what the engine gets: read `appliedRoughness`.",
    ),
    pipe(
      "appliedRoughness",
      "number | null",
      "What EPANET receives: the pipe's own value, else the pipe library's for its material and age, else `null`.",
      "When both this and `roughness` are `null` the INP carries `MISSING`.",
    ),
    pipe(
      "roughnessSource",
      '"pipe" | "library" | null',
      "Where `appliedRoughness` came from.",
    ),
    pipe("minorLoss", "number | null", "The minor loss coefficient."),
    pipe("status", '"open" | "closed" | "cv"', "The initial status."),
    pipe("material", "string | null", "The pipe's material."),
    pipe("year", "number | null", "The year the pipe was installed."),
    pipe(
      "bulkReactionCoeff",
      "number | null",
      "The bulk reaction coefficient.",
    ),
    pipe(
      "wallReactionCoeff",
      "number | null",
      "The wall reaction coefficient.",
    ),
    pipe(
      "customerPoints",
      "CustomerPoint[]",
      "The customer points connected to the pipe.",
    ),
    ...(results ? [pipeResults] : []),

    pump("status", '"on" | "off"', "The initial status."),
    pump(
      "definitionType",
      '"power" | "designPointCurve" | "standardCurve" | "curveId"',
      "How the pump is defined.",
    ),
    pump("power", "number | null", "The pump's power, for a power pump."),
    pump(
      "curvePoints",
      "{ flow: number; head: number }[] | null",
      "The pump curve's points, however the pump is defined.",
    ),
    pump(
      "designPoint",
      "{ flow: number; head: number } | null",
      "The single point of a one-point curve, else `null`.",
    ),
    pump(
      "curve",
      "string | null",
      'The library curve\'s label when `definitionType === "curveId"`, else `null`.',
    ),
    pump("speed", "number | null", "The relative speed."),
    pump("speedPattern", "string | null", "The label of the speed pattern."),
    pump(
      "efficiencyCurve",
      "string | null",
      "The label of the efficiency curve.",
    ),
    pump("energyPrice", "number | null", "The energy price."),
    pump(
      "energyPricePattern",
      "string | null",
      "The label of the energy price pattern.",
    ),
    pump(
      "control",
      "PumpControl | null",
      "The pump's structured control from the app.",
      "Pump controls are here, not in `network.rawControls`. Read both before judging why a pump is off.",
    ),
    ...(results ? [pumpResults] : []),

    valve(
      "kind",
      '"prv" | "psv" | "fcv" | "pbv" | "tcv" | "gpv" | "pcv"',
      "The valve's kind.",
    ),
    valve(
      "setting",
      "number | null",
      "The setting, in the unit its kind uses.",
    ),
    valve(
      "diameter",
      "number | null",
      "The valve's diameter, in `units.diameter`.",
    ),
    valve("minorLoss", "number | null", "The minor loss coefficient."),
    valve("status", '"active" | "open" | "closed"', "The initial status."),
    valve("curve", "string | null", "The label of the valve's curve."),
    valve(
      "targetNode",
      "NodeAsset | null",
      "A PRV's remote set-point node, or `null`.",
    ),
    ...(results ? [valveResults] : []),

    customerPoint("uid", "number", "An internal number. Never persist it."),
    customerPoint("label", "string", "The customer point's label."),
    customerPoint("type", '"customerPoint"', 'Always `"customerPoint"`.'),
    customerPoint("isSelected", "boolean", "Whether it is in the selection."),
    customerPoint("coordinates", "Position", "Where the customer is."),
    customerPoint("geometry", "GeoJSON.Point", "The point's geometry."),
    customerPoint("demands", "Demand[]", "The demand categories."),
    customerPoint(
      "demand",
      "number",
      "The sum of the categories' `base`, in `units.customerDemand`.",
    ),
    customerPoint(
      "isConnected",
      "boolean",
      "Whether it is allocated to a pipe. A disconnected point contributes no demand.",
    ),
    customerPoint("pipe", "Pipe | null", "The pipe it is allocated to."),
    customerPoint(
      "junction",
      "Junction | null",
      "The junction its demand goes to.",
    ),
    customerPoint(
      "snapPoint",
      "Position | null",
      "The point on the pipe it connects at.",
    ),
    memberOf("CustomerPoint")({
      name: "getCustom",
      signature: "getCustom(name: string): string | number | null",
      summary: "A custom attribute's value by its name, or `null`.",
    }),
  ],
});
