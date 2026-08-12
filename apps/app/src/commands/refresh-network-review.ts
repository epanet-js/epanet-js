import { useCallback, useState } from "react";
import { useReviewChecks } from "src/hooks/use-review-checks";
import { useUserTracking } from "src/infra/user-tracking";

export const useRefreshNetworkReview = () => {
  const { runAll } = useReviewChecks();
  const userTracking = useUserTracking();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshNetworkReview = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      const results = await runAll();
      userTracking.capture({
        name: "networkReview.refreshed",
        withIssues: results
          .filter((result) => result.issueCount > 0)
          .map((result) => result.check),
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [runAll, userTracking, isRefreshing]);

  return { refreshNetworkReview, isRefreshing };
};
