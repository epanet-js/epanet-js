import { AssetId } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import {
  countValidationIssues,
  validateModelAttributes,
  ValidationIssues,
} from "src/lib/model-attributes-validation";
import { CheckType } from "./types";
import { findOrphanAssets } from "./orphan-assets";
import {
  findConnectivityTrace,
  SubNetwork,
  unsuppliedSubNetworks,
} from "./connectivity-trace";

export const blockingChecks = [
  CheckType.modelAttributesValidation,
  CheckType.orphanAssets,
  CheckType.connectivityTrace,
] as const;

export type BlockingCheckType = (typeof blockingChecks)[number];

export type BlockingCheckResult =
  | {
      check: CheckType.modelAttributesValidation;
      issueCount: number;
      items: ValidationIssues;
    }
  | { check: CheckType.orphanAssets; issueCount: number; items: AssetId[] }
  | {
      check: CheckType.connectivityTrace;
      issueCount: number;
      items: SubNetwork[];
    };

type Runner = (
  model: HydraulicModel,
  signal?: AbortSignal,
) => Promise<BlockingCheckResult>;

const runners: Record<BlockingCheckType, Runner> = {
  [CheckType.modelAttributesValidation]: async (model, signal) => {
    const items = await validateModelAttributes(model, { signal });
    return {
      check: CheckType.modelAttributesValidation,
      issueCount: countValidationIssues(items),
      items,
    };
  },
  [CheckType.orphanAssets]: async (model, signal) => {
    const items = await findOrphanAssets(model, signal);
    return {
      check: CheckType.orphanAssets,
      issueCount: items.length,
      items,
    };
  },
  [CheckType.connectivityTrace]: async (model, signal) => {
    const items = await findConnectivityTrace(model, "array", signal);
    return {
      check: CheckType.connectivityTrace,
      issueCount: unsuppliedSubNetworks(items).length,
      items,
    };
  },
};

// Two of the three run in workers, so dispatching them together makes the wall
// clock the slowest check rather than the sum.
export const runBlockingChecks = async (
  model: HydraulicModel,
  options: {
    only?: readonly BlockingCheckType[];
    signal?: AbortSignal;
    onCheckDone?: (result: BlockingCheckResult) => void;
  } = {},
): Promise<BlockingCheckResult[]> => {
  const { only = blockingChecks, signal, onCheckDone } = options;

  return Promise.all(
    only.map(async (check) => {
      const result = await runners[check](model, signal);
      onCheckDone?.(result);
      return result;
    }),
  );
};

// EPANET solves a model with a disconnected tank or reservoir, so the review
// still reports them but they must not gate a run.
const blocksSimulation = (model: HydraulicModel, assetId: AssetId): boolean => {
  const type = model.assets.get(assetId)?.type;
  return type !== "tank" && type !== "reservoir";
};

export const simulationBlockers = (
  results: BlockingCheckResult[],
  model: HydraulicModel,
): BlockingCheckResult[] =>
  results.map((result) => {
    if (result.check !== CheckType.orphanAssets) return result;

    const items = result.items.filter((assetId) =>
      blocksSimulation(model, assetId),
    );
    return { ...result, items, issueCount: items.length };
  });

const reportOrder = [
  CheckType.orphanAssets,
  CheckType.connectivityTrace,
  CheckType.modelAttributesValidation,
] as const;

const topologyRuleIds: Partial<Record<BlockingCheckType, string>> = {
  [CheckType.orphanAssets]: "asset.connected",
  [CheckType.connectivityTrace]: "subNetwork.supplySource.present",
};

export const failingRuleIds = (results: BlockingCheckResult[]): string[] =>
  reportOrder.flatMap((check) => {
    const result = results.find((candidate) => candidate.check === check);
    if (!result || result.issueCount === 0) return [];

    return result.check === CheckType.modelAttributesValidation
      ? result.items.map(([ruleId]) => ruleId)
      : [topologyRuleIds[result.check] ?? result.check];
  });
