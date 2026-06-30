import { pipeRowSchema } from "@epanet-js/ejsdb";

const yearSchema = pipeRowSchema.shape.year;
const materialSchema = pipeRowSchema.shape.material;

export const isValidInstallationYear = (year: number) =>
  yearSchema.safeParse(year).success;

export const isValidMaterial = (value: string) =>
  materialSchema.safeParse(value).success;
