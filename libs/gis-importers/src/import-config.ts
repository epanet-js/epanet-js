import type { SourceUnits } from "@epanet-js/converters";

export type ImportConfig<Role extends string = string> = {
  mapping?: Partial<Record<Role, string | null>>;
  customAttributes?: string[];
  recordLimit?: number;
  units?: SourceUnits;
};
