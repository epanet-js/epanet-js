import type { CustomAttributeType, SourceCrs } from "./network-data";
import type { ParserIssue } from "./issues";
import type { ParserInput } from "./source-file";
import type { ImportResult, ParseConfig } from "./parse-config";

export type SourceAttribute = {
  name: string;
  type: CustomAttributeType;
  onEveryRecord: boolean;
};

export type SourceGeometry = "point" | "line" | "polygon" | "mixed" | "unknown";

export type SourceSummary = {
  attributes: SourceAttribute[];
  recordCount: number;
  crs: SourceCrs;
  geometry?: SourceGeometry;
};

export type ScanSourceResult = {
  summary: SourceSummary | null;
  issues: ParserIssue[];
};

export type ScanSource = (input: ParserInput) => Promise<ScanSourceResult>;

export type ParseSourceInput<Role extends string = string> = ParserInput & {
  config?: ParseConfig<Role>;
};

export type ParseSource<Role extends string = string> = (
  input: ParseSourceInput<Role>,
) => Promise<ImportResult>;

export type Importer<Role extends string = string> = {
  name: string;
  extensions: string[];
  roles: readonly Role[];
  scanSource: ScanSource;
  parseSource: ParseSource<Role>;
};
