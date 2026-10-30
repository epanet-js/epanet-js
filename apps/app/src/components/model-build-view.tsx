import { useCallback } from "react";
import { useAtom } from "jotai";
import { contentViewAtom } from "src/state/content-view";
import {
  ModelBuilderFrame,
  type ModelBuilderContext,
} from "src/dialogs/model-builder-iframe";
import { useUserTracking } from "src/infra/user-tracking";

export const ModelBuildView = () => {
  const userTracking = useUserTracking();
  const [contentView, setContentView] = useAtom(contentViewAtom);
  const step = contentView?.type === "modelBuild" ? contentView.step : null;

  const handleContextChange = useCallback(
    (context: ModelBuilderContext) => {
      setContentView((view) =>
        view?.type === "modelBuild"
          ? { type: "modelBuild", step: context.step ?? null }
          : view,
      );
    },
    [setContentView],
  );

  const handleClose = useCallback(() => {
    userTracking.capture({ name: "modelBuilder.closed", step });
    setContentView(null);
  }, [userTracking, step, setContentView]);

  return (
    <ModelBuilderFrame
      onContextChange={handleContextChange}
      onClose={handleClose}
    />
  );
};
