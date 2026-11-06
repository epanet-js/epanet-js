import { memberOf, propertyOf } from "../members";
import type {
  DocsCandidates,
  Markdown,
  Member,
  SectionDef,
  TypeDef,
} from "../types";

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
  stringSeries: [string, string][] = [],
): TypeDef => ({
  name,
  definition: `interface ${name} {
  ${values}
  ${QUALITY}
  /** this ${kind} at another timestep; a negative index counts from the end */
  at(index: number): ${name} | null;${stringSeries.map(([property, type]) => `\n  /** \`${property}\` at each entry of network.results.timesteps */\n  series(property: "${property}"): (${type})[] | null;`).join("")}
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
    [["status", '"open" | "closed"']],
  ),
  resultsType(
    "PumpResults",
    "pump",
    `flow: number;\n  head: number;\n  setting: number;\n  status: "on" | "off";\n  ${STATUS_WARNING}`,
    '"flow" | "head" | "setting"',
    "/** energy use over the run, as EPANET reports it; the same at every timestep */\n  readonly energy: { utilization: number; averageEfficiency: number; averageKwPerFlowUnit: number; averageKw: number; peakKw: number; averageCostPerDay: number; demandCharge: number } | null;",
    "A pump's simulation results at one timestep.",
    [
      ["status", '"on" | "off"'],
      ["statusWarning", '"cannot-deliver-flow" | "cannot-deliver-head" | null'],
    ],
  ),
  resultsType(
    "ValveResults",
    "valve",
    `flow: number;\n  velocity: number;\n  headloss: number;\n  setting: number;\n  status: "active" | "open" | "closed";\n  ${STATUS_WARNING}`,
    '"flow" | "velocity" | "headloss" | "setting"',
    "",
    "A valve's simulation results at one timestep.",
    [
      ["status", '"active" | "open" | "closed"'],
      [
        "statusWarning",
        '"cannot-deliver-flow" | "cannot-deliver-pressure" | null',
      ],
    ],
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
  `Values are in \`network.units[name]\`, except \`head\`, which is in \`units.actualHead\`. \`setting\` is the relative speed the engine ran the pump at, like \`pump.speed\`. ${FLOW_DIRECTION} \`energy\` has \`utilization\` and \`averageEfficiency\` in \`units.efficiency\`, \`averageKw\` and \`peakKw\` in \`units.power\`, \`averageKwPerFlowUnit\` in \`units.averageKwPerFlowUnit\`; \`averageCostPerDay\` and \`demandCharge\` are in the project's currency. \`demandCharge\` is the network's, the same for every pump. \`energy\` is \`null\` when the run reported none.`,
  `for (const pump of network.pumps) {
  const energy = pump.results?.energy;
  if (energy) console.log(pump.label, pump.results.status, energy.averageKw, network.units.power, "on", energy.utilization, network.units.efficiency, "of the time");
}`,
);

const valveResults = resultsOf(
  "Valve",
  "valve",
  `Values are in \`network.units[name]\`. \`setting\` is the setting the engine applied, in the unit its kind uses, like \`valve.setting\`. ${FLOW_DIRECTION}`,
  `const struggling = network.valves.filter((valve) => valve.results?.statusWarning);
console.log(struggling.map((valve) => \`\${valve.label}: \${valve.results.statusWarning}\`));`,
);

const SECTION: SectionDef = {
  id: "assets",
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
    ...RESULTS_TYPES,
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
    junctionResults,

    reservoir("head", "number | null", "The reservoir's head."),
    reservoir("headPattern", "string | null", "The label of the head pattern."),
    reservoirResults,

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
    tankResults,

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
    pipeResults,

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
    pumpResults,

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
    valveResults,

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
};

const CLEARS = "null clears it";

const EMPTIES = "null leaves it empty, which network review reports";

const BY_CURVE = "refused while the tank has a volume curve";

const NODE_CHANGES = `  /** ${EMPTIES} */
  elevation?: number | null;
  /** ${CLEARS} */
  initialQuality?: number | null;`;

const BY_LABEL =
  "Patterns and curves are named by label, and must be of the type the attribute takes.";

const LABEL_RULE =
  "A label is unique among the nodes or among the links, ignoring case, and is up to 64 bytes of Latin-1 characters with no spaces or semicolons. The old label stops finding the asset straight away; to swap two labels, go through a third.";

const setOf = (
  owner: string,
  changes: string,
  example: string,
  notes: Markdown[] = [],
): Member =>
  memberOf(owner)({
    name: "set",
    signature: `set(changes: {
  label?: string;
${changes}
}): void`,
    summary: `Changes the ${owner.toLowerCase()}'s attributes, in the same units its getters read them.`,
    description: [
      "The asset reads the new values straight away. The changes reach the network when the script finishes, as one change the user can undo; if the script throws, none of them do. Leave out an attribute to keep its value.",
      LABEL_RULE,
      ...notes,
    ].join(" "),
    throws: [
      "`TypeError` when `changes` names an attribute it cannot set, or gives a value of the wrong type. For an attribute another method changes, the message names that method.",
      "`TypeError` when `label` is not a valid label, or another asset has it.",
    ],
    examples: [{ code: example }],
  });

const QUALITY_SOURCE_BY =
  "The quality source changes through `setQualitySource`.";

const setQualitySourceOf = (owner: string, label: string): Member =>
  memberOf(owner)({
    name: "setQualitySource",
    signature: `setQualitySource(source: {
  type: "concen" | "mass" | "flowpaced" | "setpoint";
  /** left out, the source has no strength */
  strength?: number | null;
  /** the label of a qualitySourceStrength pattern; left out, the source has none */
  pattern?: string | null;
} | null): void`,
    summary: `Replaces the ${owner.toLowerCase()}'s quality source as a whole, or removes it with \`null\`.`,
    description:
      'What `source` leaves out is cleared, not kept: `{ type: "concen" }` drops the strength and pattern it had. The new source reads straight away through `chemicalSourceType`, `chemicalSourceStrength` and `chemicalSourcePattern`, and reaches the network with the other changes.',
    throws: [
      "`TypeError` when `source` has no `type`, names a field it does not take, or gives a value of the wrong type.",
    ],
    examples: [
      {
        code: `network.getNode("${label}").setQualitySource({ type: "concen", strength: 1.5 });
network.getNode("${label}").setQualitySource(null);`,
      },
    ],
  });

const SET_VOLUME_CURVE: Member = memberOf("Tank")({
  name: "setVolumeCurve",
  signature: "setVolumeCurve(label: string | null): void",
  summary:
    "Gives the tank a volume curve by its label, or removes it with `null`.",
  description:
    "The curve must be a volume curve with points. The tank takes `minLevel` and `maxLevel` from the curve's first and last depths, and `minVolume` from its first volume. While the tank has a curve, `set` refuses those three and `diameter`, as the curve decides them. With `null` the tank keeps the values and is sized by its `diameter` again.",
  throws: [
    "`TypeError` when `label` is not the label of a volume curve, or the curve has no points.",
  ],
  examples: [
    {
      code: `const tank = network.getNode("T1");
tank.setVolumeCurve("VOLUME");
console.log(tank.minLevel, tank.maxLevel, tank.minVolume);`,
    },
  ],
});

const SET_DEFINITION: Member = memberOf("Pump")({
  name: "setDefinition",
  signature: `setDefinition(definition:
  | { type: "power"; power: number | null }
  | { type: "designPointCurve"; designPoint: { flow: number; head: number } }
  | {
      type: "standardCurve";
      /** 3 points: shutoff, design, max flow; left out, the current curve is converted */
      curvePoints?: { flow: number; head: number }[];
    }
  | {
      type: "curveId";
      /** the label of a pump curve */
      curve: string | null;
    }
): void`,
  summary:
    "Changes how the pump is defined, as the pump type selector in the app does.",
  description:
    "Each type takes its own data, in the same units the getters read it. `type` takes the values `definitionType` reads. A `standardCurve` without `curvePoints` converts a design point the way the app does — shutoff at 1.33 times the design head, max flow at twice the design flow — and otherwise keeps the points the pump has. A library curve stops applying once the pump uses another type. A curve with problems, such as heads that do not fall, is kept and reported by network review.",
  throws: [
    "`TypeError` when `type` is not one of the four, the data the type needs is missing, a field belongs to another type, or a value has the wrong shape.",
  ],
  examples: [
    {
      code: `const pump = network.getLink("PU2");
pump.setDefinition({ type: "standardCurve" });
console.log(pump.curvePoints);
network.getLink("PU3").setDefinition({ type: "designPointCurve", designPoint: { flow: 20, head: 40 } });`,
    },
  ],
});

const SET_CONTROL: Member = memberOf("Pump")({
  name: "setControl",
  signature: `setControl(control:
  | {
      type: "timed-setting";
      /** times in seconds from 0, each later than the one before */
      steps: { time: number; status: "on" | "off"; setting: number }[];
    }
  | {
      type: "level-setting";
      tank: Tank;
      /** levels in units.level, on below off */
      on: { level: number; setting: number };
      off: { level: number };
    }
  | {
      type: "variable-speed-pump";
      /** a node, a pipe, or this pump */
      targetAsset: Asset;
      /** left out, it follows targetAsset: "level" for a tank, "pressure" for another node, "flow" for a pipe or this pump */
      quantity?: "pressure" | "level" | "flow";
      target: number;
      minSpeed: number;
      maxSpeed: number;
      /** other pumps; left out, none */
      laggedPumps?: Pump[];
      /** times in seconds from 0, each later than the one before; left out, none */
      schedule?: { time: number; target: number }[];
      /** the target tank when targetAsset is a tank; left out or null, none */
      tankLevels?: { tank: Tank; onLevel: number; offLevel: number } | null;
    }
  | null
): void`,
  summary:
    "Replaces the pump's control as a whole, or removes it with `null`, as the controls section in the app does.",
  description:
    "Takes the shape `control` reads, so a script can read the control, change it and write it back. Assets are passed as the objects the network hands out. Like the app, setting a control clears `speedPattern`; removing one leaves it. Levels must lie between the tank's `minLevel` and `maxLevel` when it has them. The new control reads straight away and reaches the network with the other changes.",
  throws: [
    "`TypeError` when `type` is not one of the three, a field belongs to another type, an asset is not of the kind the field takes, `quantity` does not match `targetAsset`, times are out of order, or levels are out of range or the on level is not below the off level.",
  ],
  examples: [
    {
      code: `const pump = network.getLink("PU1");
pump.setControl({ type: "level-setting", tank: network.getNode("T1"), on: { level: 1, setting: 1 }, off: { level: 4 } });
const booster = network.getLink("PU3");
if (booster.control?.type === "variable-speed-pump") {
  booster.setControl({ ...booster.control, maxSpeed: 1.1 });
}`,
    },
  ],
});

const setDemandsOf = (owner: string, unit: string, example: string): Member =>
  memberOf(owner)({
    name: "setDemands",
    signature: `setDemands(demands: {
  /** in ${unit} */
  base: number;
  /** the label of a demand pattern; left out or null, the demand has none */
  pattern?: string | null;
}[]): void`,
    summary: `Replaces every demand category of the ${owner === "CustomerPoint" ? "customer point" : owner.toLowerCase()}, or removes them all with \`[]\`.`,
    description:
      "Takes the same shape `demands` reads, so a script can read the categories, change them and write them back. The new categories read straight away and reach the network with the other changes.",
    throws: [
      "`TypeError` when `demands` is not a list, a category is not an object, `base` is not a number, `pattern` is not the label of a demand pattern, or a category has another field.",
    ],
    examples: [{ code: example }],
  });

export const setCustomOf = (owner: string, example: string): Member =>
  memberOf(owner)({
    name: "setCustom",
    signature: "setCustom(name: string, value: string | number | null): void",
    summary:
      "Sets a custom attribute's value by its name, the way `getCustom` reads it.",
    description:
      'A number attribute takes a number and a text attribute a string; `null` clears either, and so does `""` for text. The value reads straight away and reaches the network with the other changes.',
    throws: [
      "`TypeError` when no custom attribute of this type has that name, or the value does not match the attribute's type.",
    ],
    examples: [{ code: example }],
  });

const SET_CUSTOMER_POINT: Member = memberOf("CustomerPoint")({
  name: "set",
  signature: `set(changes: {
  label?: string;
}): void`,
  summary: "Changes the customer point's label.",
  description:
    "A label is unique among the customer points, ignoring case, and is up to 64 characters. The customer point reads the new label straight away and the old one stops finding it; the change reaches the network with the other changes.",
  throws: [
    "`TypeError` when `changes` names anything else, `label` is not a valid label, or another customer point has it.",
  ],
  examples: [
    { code: `network.getCustomerPoint("CP1").set({ label: "CP-NORTH" });` },
  ],
});

const EDITS_AFTER: [owner: string, name: string, added: Member][] = [
  ["CustomerPoint", "getCustom", SET_CUSTOMER_POINT],
  [
    "Asset",
    "getCustom",
    setCustomOf(
      "Asset",
      `const junction = network.getNode("J1");
junction.setCustom("Zone", "NORTH");
console.log(junction.getCustom("Zone"));`,
    ),
  ],
  [
    "CustomerPoint",
    "getCustom",
    setCustomOf(
      "CustomerPoint",
      `network.getCustomerPoint("CP1").setCustom("Use", "RESIDENTIAL");`,
    ),
  ],
  [
    "CustomerPoint",
    "getCustom",
    setDemandsOf(
      "CustomerPoint",
      "units.customerDemand",
      `network.getCustomerPoint("CP1").setDemands([{ base: 0.3 }]);`,
    ),
  ],
];

const editsAfter = (member: Member): Member[] =>
  EDITS_AFTER.filter(
    ([owner, name]) => member.owner === owner && member.name === name,
  ).map(([, , added]) => added);

const SET_KIND: Member = memberOf("Valve")({
  name: "setKind",
  signature:
    'setKind(kind: "prv" | "psv" | "fcv" | "pbv" | "tcv" | "gpv" | "pcv"): void',
  summary: "Changes the valve's kind.",
  description:
    "The valve drops its curve when the new kind takes a different one: a gpv takes a headloss curve, a pcv a valve curve, the others none. `setting` keeps its number, which the new kind reads in its own unit, and a target node only applies while the valve is a prv. Set the curve or setting afterwards with `set`.",
  throws: ["`TypeError` when `kind` is not a valve kind."],
  examples: [
    {
      code: `const valve = network.getLink("V1");
valve.setKind("fcv");
valve.set({ setting: 12 });`,
    },
  ],
});

const EDITS_BEFORE = new Map<Member, Member[]>([
  [
    junctionResults,
    [
      setOf(
        "Junction",
        `${NODE_CHANGES}
  /** ${CLEARS} */
  emitterCoefficient?: number | null;`,
        `network.getNode("J1").set({ elevation: 12, emitterCoefficient: null });`,
        ["The demands change through `setDemands`.", QUALITY_SOURCE_BY],
      ),
      setDemandsOf(
        "Junction",
        "units.baseDemand",
        `network.getNode("J1").setDemands([{ base: 5 }, { base: 2 }]);`,
      ),
      setQualitySourceOf("Junction", "J1"),
    ],
  ],
  [
    reservoirResults,
    [
      setOf(
        "Reservoir",
        `${NODE_CHANGES}
  /** ${EMPTIES} */
  head?: number | null;
  /** the label of a reservoirHead pattern; ${CLEARS} */
  headPattern?: string | null;`,
        `network.getNode("R1").set({ head: 60 });`,
        [BY_LABEL, QUALITY_SOURCE_BY],
      ),
      setQualitySourceOf("Reservoir", "R1"),
    ],
  ],
  [
    tankResults,
    [
      setOf(
        "Tank",
        `${NODE_CHANGES}
  /** ${EMPTIES} */
  initialLevel?: number | null;
  /** ${BY_CURVE}; ${EMPTIES} */
  minLevel?: number | null;
  /** ${BY_CURVE}; ${EMPTIES} */
  maxLevel?: number | null;
  /** in units.tankDiameter; ${BY_CURVE}; ${EMPTIES} */
  diameter?: number | null;
  /** ${BY_CURVE}; ${CLEARS} */
  minVolume?: number | null;
  overflow?: boolean;
  mixingModel?: "mixed" | "2comp" | "fifo" | "lifo";
  /** ${CLEARS} */
  mixingFraction?: number | null;
  /** ${CLEARS} */
  bulkReactionCoeff?: number | null;`,
        `network.getNode("T1").set({ initialLevel: 2, overflow: true });`,
        [
          "The volume curve changes through `setVolumeCurve`.",
          QUALITY_SOURCE_BY,
        ],
      ),
      SET_VOLUME_CURVE,
      setQualitySourceOf("Tank", "T1"),
    ],
  ],
  [
    pipeResults,
    [
      setOf(
        "Pipe",
        `  /** in units.diameter; ${EMPTIES} */
  diameter?: number | null;
  /** in units.length; ${EMPTIES} */
  length?: number | null;
  /** null drops the value set on the pipe, so the pipe library applies */
  roughness?: number | null;
  /** ${CLEARS} */
  minorLoss?: number | null;
  status?: "open" | "closed" | "cv";
  /** ${CLEARS} */
  bulkReactionCoeff?: number | null;
  /** ${CLEARS} */
  wallReactionCoeff?: number | null;
  /** the pipe library applies its roughness when the pipe has none; ${CLEARS} */
  material?: string | null;
  /** a whole number; ${CLEARS} */
  year?: number | null;`,
        `const pipe = network.getLink("P1");
pipe.set({ diameter: 150, status: "closed" });
console.log(pipe.diameter, network.units.diameter, pipe.status);`,
      ),
    ],
  ],
  [
    pumpResults,
    [
      setOf(
        "Pump",
        `  status?: "on" | "off";
  /** ${CLEARS} */
  speed?: number | null;
  /** the label of a pumpSpeed pattern; ${CLEARS} */
  speedPattern?: string | null;
  /** the label of an efficiency curve; ${CLEARS} */
  efficiencyCurve?: string | null;
  /** ${CLEARS} */
  energyPrice?: number | null;
  /** the label of an energyPrice pattern; ${CLEARS} */
  energyPricePattern?: string | null;`,
        `network.getLink("PU1").set({ status: "off" });`,
        [
          BY_LABEL,
          "The definition changes through `setDefinition`, the control through `setControl`.",
        ],
      ),
      SET_DEFINITION,
      SET_CONTROL,
    ],
  ],
  [
    valveResults,
    [
      setOf(
        "Valve",
        `  /** in units.diameter; ${EMPTIES} */
  diameter?: number | null;
  /** in the unit of the valve kind; ${EMPTIES} */
  setting?: number | null;
  /** ${CLEARS} */
  minorLoss?: number | null;
  status?: "active" | "open" | "closed";
  /** the label of a headloss curve for a gpv, or a valve curve for a pcv; ${CLEARS} */
  curve?: string | null;
  /** a prv only: a node from targetNodeOptions(); ${CLEARS} */
  targetNode?: NodeAsset | null;`,
        `network.getLink("V1").set({ setting: 45 });`,
        [BY_LABEL, "The kind changes through `setKind`."],
      ),
      SET_KIND,
    ],
  ],
]);

export const sectionFor = ({ edits }: DocsCandidates): SectionDef =>
  edits
    ? {
        ...SECTION,
        intro:
          "Every asset is an object of getters. A value the model has not set reads as `null`. Every asset also changes through `set`.",
        members: (SECTION.members ?? []).flatMap((member) => [
          ...(EDITS_BEFORE.get(member) ?? []),
          member,
          ...editsAfter(member),
        ]),
      }
    : SECTION;
