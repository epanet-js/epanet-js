import { z } from "zod";
import type { ProjectSettings } from "./project-settings";
import type { Unit } from "src/quantity";

const unitSchema: z.ZodType<Unit> = z
  .enum([
    "m",
    "mm",
    "in",
    "ft",
    "l/s",
    "l/min",
    "l/h",
    "l/d",
    "km",
    "m/km",
    "ft/kft",
    "gal/min",
    "gal/d",
    "mwc",
    "psi",
    "kPa",
    "bar",
    "fwc",
    "m/s",
    "ft/s",
    "ft^3",
    "ft^3/s",
    "ft^3/d",
    "m^3",
    "m^3/h",
    "m^3/d",
    "Mgal/d",
    "IMgal/d",
    "Ml/d",
    "acft/d",
    "kW",
    "hp",
    "%",
    "m^2",
    "ft^2",
    "kW/m^3",
    "kW/Mgal",
    "h",
    "mg/L",
    "ug/L",
  ])
  .nullable();

const unitsSpecSchema = z.object({
  diameter: unitSchema,
  length: unitSchema,
  roughness: unitSchema,
  minorLoss: unitSchema,
  flow: unitSchema,
  velocity: unitSchema,
  elevation: unitSchema,
  baseDemand: unitSchema,
  directDemand: unitSchema,
  actualDemand: unitSchema,
  netFlow: unitSchema,
  customerDemand: unitSchema,
  customerDemandPerDay: unitSchema,
  emitterCoefficient: unitSchema,
  pressure: unitSchema,
  headloss: unitSchema,
  unitHeadloss: unitSchema,
  head: unitSchema,
  actualHead: unitSchema,
  power: unitSchema,
  speed: unitSchema,
  tcvSetting: unitSchema,
  initialLevel: unitSchema,
  minLevel: unitSchema,
  maxLevel: unitSchema,
  minVolume: unitSchema,
  level: unitSchema,
  volume: unitSchema,
  tankDiameter: unitSchema,
  tankArea: unitSchema,
  efficiency: unitSchema,
  averageKwPerFlowUnit: unitSchema,
  waterAge: unitSchema,
  waterTrace: unitSchema,
  chemicalConcentration: unitSchema,
  mixingFraction: unitSchema,
});

const quantityDefaultsSchema = z.record(z.string(), z.number());

const defaultsSpecSchema = z.object({
  pipe: quantityDefaultsSchema,
  junction: quantityDefaultsSchema,
  reservoir: quantityDefaultsSchema,
  pump: quantityDefaultsSchema,
  valve: quantityDefaultsSchema,
  tank: quantityDefaultsSchema,
});

const formattingSpecSchema = z.object({
  decimals: z.record(z.string(), z.number()),
  defaultDecimals: z.number(),
});

const headlossFormulaSchema = z.enum(["H-W", "D-W", "C-M"]);

const projectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("wgs84"),
    id: z.string(),
    name: z.string(),
  }),
  z.object({
    type: z.literal("xy-grid"),
    id: z.string(),
    name: z.string(),
    centroid: z.array(z.number()),
  }),
  z.object({
    type: z.literal("proj4"),
    id: z.string(),
    name: z.string(),
    code: z.string(),
    deprecated: z.boolean().optional(),
  }),
]);

export const projectSettingsSchema: z.ZodType<ProjectSettings> = z.object({
  name: z.string(),
  units: unitsSpecSchema,
  defaults: defaultsSpecSchema,
  headlossFormula: headlossFormulaSchema,
  formatting: formattingSpecSchema,
  projection: projectionSchema,
});
