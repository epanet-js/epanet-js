import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { usePermissions } from "src/hooks/use-permissions";
import { useShowPriorityAccessDialog } from "src/hooks/use-priority-access";
import { useTranslate } from "src/hooks/use-translate";

export const useImportZones = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const onlyEarlyAccess = useEarlyAccess();
  const { canUseZones } = usePermissions();
  const showPriorityAccess = useShowPriorityAccessDialog();
  const translate = useTranslate();

  const importZones = useCallback(
    ({ source }: { source: string }) => {
      onlyEarlyAccess(() => {
        userTracking.capture({
          name: "importZones.started",
          source,
          canUseZones,
        });

        if (!canUseZones) {
          showPriorityAccess({
            featureName: translate("importZones.title"),
          });
          return;
        }

        setDialogState({ type: "importZones" });
      });
    },
    [
      setDialogState,
      userTracking,
      onlyEarlyAccess,
      canUseZones,
      showPriorityAccess,
      translate,
    ],
  );

  return importZones;
};
