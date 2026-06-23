import { z } from "zod";
import { pipeRowSchema } from "@epanet-js/ejsdb";
import { CustomerPoint } from "@epanet-js/hydraulic-model";
import { Rule, ValidatableEntity } from "./types";

const fromSchema =
  (schema: z.ZodTypeAny) =>
  (value: unknown): boolean =>
    schema.safeParse(value).success;

const field =
  (name: string) =>
  (entity: ValidatableEntity): unknown =>
    (entity as unknown as Record<string, unknown>)[name];

const roughnessBase = pipeRowSchema.shape.roughness.unwrap();

export const RULES: Rule[] = [
  {
    id: "pipe.roughness.present",
    entityType: "pipe",
    field: "roughness",
    accessor: field("roughness"),
    validate: fromSchema(z.number()),
    severity: "error",
    message: "required",
  },
  {
    id: "pipe.roughness.positive",
    entityType: "pipe",
    field: "roughness",
    accessor: field("roughness"),
    validate: fromSchema(roughnessBase.positive()),
    severity: "error",
    message: "mustBePositive",
  },
  {
    id: "customerPoint.connected",
    entityType: "customerPoint",
    accessor: (entity) => entity,
    validate: (_value, entity) => (entity as CustomerPoint).connection !== null,
    severity: "warning",
    message: "disconnected",
  },
];
