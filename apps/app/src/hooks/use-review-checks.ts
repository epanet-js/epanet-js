import { useCallback, useMemo } from "react";
import { useAtomCallback } from "jotai/utils";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { ReviewResults, reviewResultsAtom } from "src/state/network-review";
import {
  CheckType,
  blockingChecks,
  BlockingCheckResult,
  BlockingCheckType,
  runBlockingChecks,
  unsuppliedSubNetworks,
} from "src/lib/network-review";
import { listTopologyIssues } from "@epanet-js/network-review";
import { countValidationIssues } from "src/lib/model-attributes-validation";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useModelAttributeRules } from "src/hooks/use-model-attribute-rules";

export type CachedCheckType = keyof ReviewResults;
type ItemsOf<K extends CachedCheckType> = NonNullable<
  ReviewResults[K]
>["items"];

export const useCachedCheck = <K extends CachedCheckType>(check: K) => {
  const read = useAtomCallback(
    useCallback(
      (get): ItemsOf<K> | null => {
        const entry = get(reviewResultsAtom)[check];
        if (!entry) return null;
        if (entry.modelVersion !== get(stagingModelDerivedAtom).version)
          return null;

        return entry.items as ItemsOf<K>;
      },
      [check],
    ),
  );

  const write = useAtomCallback(
    useCallback(
      (
        get,
        set,
        items: ItemsOf<K>,
        issueCount: number,
        modelVersion: string,
      ) => {
        if (get(stagingModelDerivedAtom).version !== modelVersion) return;

        set(
          reviewResultsAtom,
          (results) =>
            ({
              ...results,
              [check]: { modelVersion, issueCount, items },
            }) as ReviewResults,
        );
      },
      [check],
    ),
  );

  return { read, write };
};

// The read/write pairs are destructured rather than held as objects because
// useCachedCheck returns a fresh object each render; callers key effects off
// ensureFresh, which would then change identity on every render.
export const useReviewChecks = () => {
  const rules = useModelAttributeRules();
  const { read: readAttributes, write: writeAttributes } = useCachedCheck(
    CheckType.modelAttributesValidation,
  );
  const { read: readOrphans, write: writeOrphans } = useCachedCheck(
    CheckType.orphanAssets,
  );
  const { read: readConnectivity, write: writeConnectivity } = useCachedCheck(
    CheckType.connectivityTrace,
  );

  const { read: readTopology, write: writeTopology } = useCachedCheck(
    CheckType.topologyChecks,
  );
  const isTopologyChecksOn = useFeatureFlag("FLAG_TOPOLOGY_CHECKS");
  const enabledChecks = useMemo(
    () =>
      isTopologyChecksOn
        ? blockingChecks
        : blockingChecks.filter((check) => check !== CheckType.topologyChecks),
    [isTopologyChecksOn],
  );

  const cache = useCallback(
    (result: BlockingCheckResult, modelVersion: string) => {
      switch (result.check) {
        case CheckType.modelAttributesValidation:
          return writeAttributes(result.items, result.issueCount, modelVersion);
        case CheckType.orphanAssets:
          return writeOrphans(result.items, result.issueCount, modelVersion);
        case CheckType.connectivityTrace:
          return writeConnectivity(
            result.items,
            result.issueCount,
            modelVersion,
          );
        case CheckType.topologyChecks:
          return writeTopology(result.items, result.issueCount, modelVersion);
      }
    },
    [writeAttributes, writeOrphans, writeConnectivity, writeTopology],
  );

  const run = useAtomCallback(
    useCallback(
      async (
        get,
        _set,
        only: readonly BlockingCheckType[],
        options: {
          signal?: AbortSignal;
          onCheckDone?: (result: BlockingCheckResult) => void;
        } = {},
      ) => {
        const model = get(stagingModelDerivedAtom);
        const modelVersion = model.version;

        return runBlockingChecks(model, {
          only,
          signal: options.signal,
          rules,
          onCheckDone: (result) => {
            cache(result, modelVersion);
            options.onCheckDone?.(result);
          },
        });
      },
      [cache, rules],
    ),
  );

  const cachedResult = useCallback(
    (check: BlockingCheckType): BlockingCheckResult | null => {
      switch (check) {
        case CheckType.modelAttributesValidation: {
          const items = readAttributes();
          return items === null
            ? null
            : {
                check,
                items,
                issueCount: countValidationIssues(items),
              };
        }
        case CheckType.orphanAssets: {
          const items = readOrphans();
          return items === null
            ? null
            : { check, items, issueCount: items.length };
        }
        case CheckType.connectivityTrace: {
          const items = readConnectivity();
          return items === null
            ? null
            : {
                check,
                items,
                issueCount: unsuppliedSubNetworks(items).length,
              };
        }
        case CheckType.topologyChecks: {
          const items = readTopology();
          return items === null
            ? null
            : {
                check,
                items,
                issueCount: listTopologyIssues(items).length,
              };
        }
      }
    },
    [readAttributes, readOrphans, readConnectivity, readTopology],
  );

  // Runs only what the cache cannot answer, so a review already done in the
  // panel makes this return without touching a worker.
  const ensureFresh = useCallback(
    async (options?: {
      signal?: AbortSignal;
      onCheckDone?: (result: BlockingCheckResult) => void;
    }): Promise<BlockingCheckResult[]> => {
      const cached = enabledChecks
        .map(cachedResult)
        .filter((result): result is BlockingCheckResult => result !== null);

      const stale = enabledChecks.filter(
        (check) => !cached.some((result) => result.check === check),
      );

      cached.forEach((result) => options?.onCheckDone?.(result));
      if (stale.length === 0) return cached;

      const computed = await run(stale, options);
      return [...cached, ...computed];
    },
    [enabledChecks, cachedResult, run],
  );

  return { ensureFresh };
};
