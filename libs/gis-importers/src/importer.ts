import type {
  CustomAttributeType,
  NetworkData,
  ParserInput,
  Issue,
  SourceCrs,
} from "@epanet-js/converters";
import type { Feature } from "geojson";
import type { Proj4Projection } from "@epanet-js/projections";
import type { ImportConfig } from "./import-config";

export type SourceAttribute = {
  name: string;
  type: CustomAttributeType;
  onEveryRecord: boolean;
};

export type SourceGeometry = "point" | "line" | "polygon" | "mixed" | "unknown";

export type SourceSummary = {
  attributes: SourceAttribute[];
  recordCount: number;
  originalProjection?: string;
  geometry?: SourceGeometry;
};

export type GisInput = ParserInput & {
  crs?: SourceCrs;
  projections?: Map<string, Proj4Projection>;
};

export type ImportResult = {
  network: Partial<NetworkData>;
  issues: Issue[];
};

export type ScanSourceResult = {
  summary: SourceSummary | null;
  issues: Issue[];
};

export type ScanSource = (input: GisInput) => Promise<ScanSourceResult>;

export type ImportFromSourceInput<Role extends string = string> = GisInput & {
  config?: ImportConfig<Role>;
};

export type ImportFromSource<Role extends string = string> = (
  input: ImportFromSourceInput<Role>,
) => Promise<ImportResult>;

export type ImportFromFeatures<Role extends string = string> = (
  features: Feature[],
  config?: ImportConfig<Role>,
) => ImportResult;

export type Importer<Role extends string = string> = {
  name: string;
  extensions: string[];
  roles: readonly Role[];
  scanSource: ScanSource;
  importFromSource: ImportFromSource<Role>;
  importFromFeatures: ImportFromFeatures<Role>;
};
