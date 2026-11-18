import { AssetId } from "@epanet-js/hydraulic-model";
import {
  ORPHAN_ASSETS_RULE_ID,
  UNSUPPLIED_SUBNETWORK_RULE_ID,
  blocksSimulation,
  listTopologyIssues,
  type TopologyIssues,
} from "@epanet-js/network-review";
import { HydraulicModel } from "src/hydraulic-model";
import {
  countValidationIssues,
  Rule,
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
import { findTopologyIssues } from "./topology-checks";

export const blockingChecks = [
  CheckType.modelAttributesValidation,
  CheckType.orphanAssets,
  CheckType.connectivityTrace,
  CheckType.topologyChecks,
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
    }
  | {
      check: CheckType.topologyChecks;
      issueCount: number;
      items: TopologyIssues;
    };

type Runner = (
  model: HydraulicModel,
  options: { signal?: AbortSignal; rules?: Rule[] },
) => Promise<BlockingCheckResult>;

const runners: Record<BlockingCheckType, Runner> = {
  [CheckType.modelAttributesValidation]: async (model, { signal, rules }) => {
    const items = await validateModelAttributes(model, { signal, rules });
    return {
      check: CheckType.modelAttributesValidation,
      issueCount: countValidationIssues(items),
      items,
    };
  },
  [CheckType.orphanAssets]: async (model, { signal }) => {
    const items = await findOrphanAssets(model, signal);
    return {
      check: CheckType.orphanAssets,
      issueCount: items.length,
      items,
    };
  },
  [CheckType.connectivityTrace]: async (model, { signal }) => {
    const items = await findConnectivityTrace(model, "array", signal);
    return {
      check: CheckType.connectivityTrace,
      issueCount: unsuppliedSubNetworks(items).length,
      items,
    };
  },
  [CheckType.topologyChecks]: async (model, { signal }) => {
    const items = await findTopologyIssues(model, signal);
    return {
      check: CheckType.topologyChecks,
      issueCount: listTopologyIssues(items).length,
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
    rules?: Rule[];
    onCheckDone?: (result: BlockingCheckResult) => void;
  } = {},
): Promise<BlockingCheckResult[]> => {
  const { only = blockingChecks, signal, rules, onCheckDone } = options;

  return Promise.all(
    only.map(async (check) => {
      const result = await runners[check](model, { signal, rules });
      onCheckDone?.(result);
      return result;
    }),
  );
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
  CheckType.topologyChecks,
  CheckType.modelAttributesValidation,
] as const;

const topologyRuleIds: Partial<Record<BlockingCheckType, string>> = {
  [CheckType.orphanAssets]: ORPHAN_ASSETS_RULE_ID,
  [CheckType.connectivityTrace]: UNSUPPLIED_SUBNETWORK_RULE_ID,
};

export const failingRuleIds = (results: BlockingCheckResult[]): string[] =>
  reportOrder.flatMap((check) => {
    const result = results.find((candidate) => candidate.check === check);
    if (!result || result.issueCount === 0) return [];

    switch (result.check) {
      case CheckType.modelAttributesValidation:
        return result.items.map(([ruleId]) => ruleId);
      case CheckType.topologyChecks:
        return [
          ...new Set(listTopologyIssues(result.items).map((i) => i.ruleId)),
        ];
      default:
        return [topologyRuleIds[result.check] ?? result.check];
    }
  });
