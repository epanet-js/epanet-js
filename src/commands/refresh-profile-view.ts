import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { profileViewAtom } from "src/state/profile-view";
import {
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { isUnprojectedAtom } from "src/state/map-projection";
import { dialogAtom } from "src/state/dialog";
import { buildProfileViewSnapshot } from "src/panels/profile-view/snapshot";

export const useRefreshProfileView = () => {
  const snapshot = useAtomValue(profileViewAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const results = useAtomValue(simulationResultsDerivedAtom);
  const projectSettings = useAtomValue(projectSettingsAtom);
  const isUnprojected = useAtomValue(isUnprojectedAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setDialog = useSetAtom(dialogAtom);

  return useCallback(() => {
    if (!snapshot) return;

    const built = buildProfileViewSnapshot({
      startNodeId: snapshot.startNodeId,
      endNodeId: snapshot.endNodeId,
      hydraulicModel,
      results,
      projectSettings,
      isUnprojected,
    });

    if ("error" in built) {
      setDialog({ type: "profileNoPath" });
      return;
    }

    setProfileView(built.snapshot);
  }, [
    snapshot,
    hydraulicModel,
    results,
    projectSettings,
    isUnprojected,
    setProfileView,
    setDialog,
  ]);
};
