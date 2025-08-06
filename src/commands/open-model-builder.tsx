import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";

const MODEL_BUILDER_URL = "https://utils.epanetjs.com/model-builder";

export const useOpenModelBuilder = () => {
  const userTracking = useUserTracking();

  const openModelBuilder = useCallback(
    ({ source }: { source: string }) => {
      userTracking.capture({
        name: "modelBuilder.opened",
        source,
      });

      window.open(MODEL_BUILDER_URL, "_blank");
    },
    [userTracking],
  );

  return openModelBuilder;
};
