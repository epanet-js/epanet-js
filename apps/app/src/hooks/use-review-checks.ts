import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { ReviewResults, reviewResultsAtom } from "src/state/network-review";
import { CheckType } from "src/panels/network-review/common";
import {
  blockingChecks,
  BlockingCheckResult,
  BlockingCheckType,
  runBlockingChecks,
} from "src/lib/network-review/blocking-checks";

export type CachedCheckType = keyof ReviewResults;
type ItemsOf<K extends CachedCheckType> = NonNullable<
  ReviewResults[K]
>["items"];

const withoutOtherVersions = (
  results: ReviewResults,
  modelVersion: string,
): ReviewResults =>
  Object.fromEntries(
    Object.entries(results).filter(
      ([, entry]) => entry.modelVersion === modelVersion,
    ),
  ) as ReviewResults;

export const useCachedCheck = <K extends CachedCheckType>(check: K) => {
  const isPreSimulationChecksOn = useFeatureFlag("FLAG_PRE_SIMULATION_CHECKS");
  const isReviewCacheOn =
    check === CheckType.modelAttributesValidation || isPreSimulationChecksOn;

  const read = useAtomCallback(
    useCallback(
      (get): ItemsOf<K> | null => {
        if (!isReviewCacheOn) return null;

        const entry = get(reviewResultsAtom)[check];
        if (!entry) return null;
        if (entry.modelVersion !== get(stagingModelDerivedAtom).version)
          return null;

        return entry.items as ItemsOf<K>;
      },
      [check, isReviewCacheOn],
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
        if (!isReviewCacheOn) return;
        if (get(stagingModelDerivedAtom).version !== modelVersion) return;

        set(
          reviewResultsAtom,
          (results) =>
            ({
              ...withoutOtherVersions(results, modelVersion),
              [check]: { modelVersion, issueCount, items },
            }) as ReviewResults,
        );
      },
      [check, isReviewCacheOn],
    ),
  );

  return { read, write };
};

export const useReviewChecks = () => {
  const attributes = useCachedCheck(CheckType.modelAttributesValidation);
  const orphans = useCachedCheck(CheckType.orphanAssets);
  const connectivity = useCachedCheck(CheckType.connectivityTrace);

  const cache = useCallback(
    (result: BlockingCheckResult, modelVersion: string) => {
      switch (result.check) {
        case CheckType.modelAttributesValidation:
          return attributes.write(
            result.items,
            result.issueCount,
            modelVersion,
          );
        case CheckType.orphanAssets:
          return orphans.write(result.items, result.issueCount, modelVersion);
        case CheckType.connectivityTrace:
          return connectivity.write(
            result.items,
            result.issueCount,
            modelVersion,
          );
      }
    },
    [attributes, orphans, connectivity],
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
          onCheckDone: (result) => {
            cache(result, modelVersion);
            options.onCheckDone?.(result);
          },
        });
      },
      [cache],
    ),
  );

  const runAll = useCallback(
    (options?: {
      signal?: AbortSignal;
      onCheckDone?: (result: BlockingCheckResult) => void;
    }) => run(blockingChecks, options),
    [run],
  );

  return { runAll };
};
