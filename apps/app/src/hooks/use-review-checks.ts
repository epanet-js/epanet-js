import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { ReviewResults, reviewResultsAtom } from "src/state/network-review";

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
              ...withoutOtherVersions(results, modelVersion),
              [check]: { modelVersion, issueCount, items },
            }) as ReviewResults,
        );
      },
      [check],
    ),
  );

  return { read, write };
};
