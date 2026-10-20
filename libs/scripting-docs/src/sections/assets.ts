import { memberOf, propertyOf } from "../members";
import type { Section } from "../types";

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

export const SECTION: Section = {
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

    reservoir("head", "number | null", "The reservoir's head."),
    reservoir("headPattern", "string | null", "The label of the head pattern."),

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
