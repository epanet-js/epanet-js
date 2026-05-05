import type { QuickGraphAssetType } from "src/state/quick-graph";
import {
  QUICK_GRAPH_PROPERTIES,
  QUALITY_OPTIONS,
} from "src/panels/asset-panel/quick-graph/quick-graph-section";
import type { QualityAnalysisType } from "src/simulation/epanet/simulation-metadata";
import type {
  NodeType,
  LinkType,
  AssetType,
} from "src/hydraulic-model/asset-types";

export type ChartProperty = {
  value: string;
  labelKey: string;
  quantityKey: string;
};

const NODE_TYPES: NodeType[] = ["junction", "reservoir", "tank"];
const LINK_TYPES: LinkType[] = ["pipe", "pump", "valve"];

export function isNodeType(t: AssetType): t is NodeType {
  return NODE_TYPES.includes(t as NodeType);
}

export function isLinkType(t: AssetType): t is LinkType {
  return LINK_TYPES.includes(t as LinkType);
}

export function getAvailableProperties(
  assetTypes: QuickGraphAssetType[],
  qualityType: QualityAnalysisType | null,
): ChartProperty[] {
  if (assetTypes.length === 0) return [];

  const sets = assetTypes.map(
    (t) => QUICK_GRAPH_PROPERTIES[t] as ChartProperty[],
  );

  // Intersection: keep only properties present in ALL asset types
  const baseValues = new Set(sets[0].map((p) => p.value));
  for (let i = 1; i < sets.length; i++) {
    const vals = new Set(sets[i].map((p) => p.value));
    for (const v of baseValues) {
      if (!vals.has(v)) baseValues.delete(v);
    }
  }

  const base = sets[0].filter((p) => baseValues.has(p.value));

  const qualityOption =
    qualityType === "age"
      ? QUALITY_OPTIONS.find((o) => o.value === "waterAge")
      : qualityType === "trace"
        ? QUALITY_OPTIONS.find((o) => o.value === "waterTrace")
        : qualityType === "chemical"
          ? QUALITY_OPTIONS.find((o) => o.value === "chemicalConcentration")
          : null;

  if (qualityOption) {
    return [
      ...base,
      {
        value: qualityOption.value,
        labelKey: qualityOption.value,
        quantityKey: qualityOption.quantityKey,
      },
    ];
  }

  return base;
}

export type AssetClassification = {
  nodeTypes: NodeType[];
  linkTypes: LinkType[];
  hasNodes: boolean;
  hasLinks: boolean;
};

export function classifyAssetTypes(
  assetTypes: AssetType[],
): AssetClassification {
  const nodeTypes = [...new Set(assetTypes.filter(isNodeType))];
  const linkTypes = [...new Set(assetTypes.filter(isLinkType))];
  return {
    nodeTypes,
    linkTypes,
    hasNodes: nodeTypes.length > 0,
    hasLinks: linkTypes.length > 0,
  };
}
