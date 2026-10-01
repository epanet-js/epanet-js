import { nanoid } from "nanoid";
import { ConsecutiveIdsGenerator, IdGenerator } from "@epanet-js/id-generator";
import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { Demands, createEmptyDemands } from "./demands";
import { CustomerPoints, initializeCustomerPoints } from "./customer-points";
import { CustomerPointsLookup } from "./customer-points-lookup";
import type { Curves } from "./curves";
import type { Patterns } from "./patterns";
import type { PipeMaterial } from "./pipe-materials";
import { AssetIndex } from "./asset-index";
import { RawControls, createEmptyRawControls } from "./raw-controls";
import {
  Controls,
  createEmptyControls,
  ControlsLookup,
  buildControlsLookup,
} from "./controls";
import {
  CustomAttributesDefinition,
  emptyCustomAttributesDefinition,
} from "./custom-attributes";

export type HydraulicModel = {
  version: string;
  assets: AssetsMap;
  customerPoints: CustomerPoints;
  customerPointsLookup: CustomerPointsLookup;
  topology: Topology;
  assetIndex: AssetIndex;
  demands: Demands;
  curves: Curves;
  patterns: Patterns;
  pipeMaterials: PipeMaterial[];
  rawControls: RawControls;
  controls: Controls;
  controlsLookup: ControlsLookup;
  customAttributes: CustomAttributesDefinition;
};

export const initializeHydraulicModel = ({
  version = nanoid(),
  demands = createEmptyDemands(),
  rawControls = createEmptyRawControls(),
  controls = createEmptyControls(),
  idGenerator,
  assets,
  topology,
  assetIndex,
  customerPoints,
  customerPointsLookup,
  patterns,
  curves,
  pipeMaterials,
  customAttributes,
}: {
  version?: string;
  demands?: Demands;
  rawControls?: RawControls;
  controls?: Controls;
  idGenerator?: IdGenerator;
  assets?: AssetsMap;
  topology?: Topology;
  assetIndex?: AssetIndex;
  customerPoints?: CustomerPoints;
  customerPointsLookup?: CustomerPointsLookup;
  patterns?: Patterns;
  curves?: Curves;
  pipeMaterials?: PipeMaterial[];
  customAttributes?: CustomAttributesDefinition;
} = {}): HydraulicModel => {
  const assetIdGenerator = idGenerator ?? new ConsecutiveIdsGenerator();
  const resolvedAssets = assets ?? new Map();
  return {
    version,
    assets: resolvedAssets,
    customerPoints: customerPoints ?? initializeCustomerPoints(),
    customerPointsLookup: customerPointsLookup ?? new CustomerPointsLookup(),
    topology: topology ?? new Topology(),
    assetIndex: assetIndex ?? new AssetIndex(assetIdGenerator, resolvedAssets),
    demands,
    curves: curves ?? (new Map() as Curves),
    patterns: patterns ?? (new Map() as Patterns),
    pipeMaterials: pipeMaterials ?? [],
    rawControls,
    controls,
    controlsLookup: buildControlsLookup(controls),
    customAttributes: customAttributes ?? emptyCustomAttributesDefinition(),
  };
};
