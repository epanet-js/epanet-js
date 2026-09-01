import type { NetworkData, SourceCrs, SourceUnits } from "./network-data";
import type { ParserIssue } from "./issues";

export type ParseConfig<Role extends string = string> = {
  mapping?: Partial<Record<Role, string | null>>;
  customAttributes?: string[];
  recordLimit?: number;
  units?: SourceUnits;
  crs?: SourceCrs;
};

export type ImportResult = {
  network: Partial<NetworkData>;
  issues: ParserIssue[];
};
