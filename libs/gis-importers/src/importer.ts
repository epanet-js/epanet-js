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

export type SourceGeometry = "point" | "line" | "polygon" | "unknown";

export type GeometryGroup = {
  geometry: SourceGeometry;
  features: Feature[];
  attributes: SourceAttribute[];
};

export type SourceContents = {
  attributes: SourceAttribute[];
  recordCount: number;
  groups: GeometryGroup[];
};

export type CoordinateAttributes = { x: string; y: string };

export type GisInput = ParserInput & {
  crs?: SourceCrs;
  coordinateAttributes?: CoordinateAttributes;
  projections?: Map<string, Proj4Projection>;
};

export type ImportResult = {
  network: Partial<NetworkData>;
  issues: Issue[];
};

export type ScanSourceResult = {
  contents: SourceContents | null;
  sourceProjection?: Proj4Projection;
  issues: Issue[];
};

type ScanSource = (input: GisInput) => Promise<ScanSourceResult>;

export type ImportOptions = {
  signal?: AbortSignal;
};

type ImportFromSourceInput<Role extends string = string> = GisInput &
  ImportOptions & {
    config?: ImportConfig<Role>;
  };

type ImportFromSource<Role extends string = string> = (
  input: ImportFromSourceInput<Role>,
) => Promise<ImportResult>;

type ImportFromFeatures<Role extends string = string> = (
  features: Feature[],
  config?: ImportConfig<Role>,
  options?: ImportOptions,
) => Promise<ImportResult>;

export type Importer<Role extends string = string> = {
  name: string;
  extensions: string[];
  roles: readonly Role[];
  scanSource: ScanSource;
  importFromSource: ImportFromSource<Role>;
  importFromFeatures: ImportFromFeatures<Role>;
};
