import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { usePermissions } from "src/hooks/use-permissions";
import { useShowPriorityAccessDialog } from "src/hooks/use-priority-access";
import { useTranslate } from "src/hooks/use-translate";
import { zonesAtom } from "src/state/zones";

export const useImportZones = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const zones = useAtomValue(zonesAtom);
  const userTracking = useUserTracking();
  const onlyEarlyAccess = useEarlyAccess();
  const { canUseZones } = usePermissions();
  const showPriorityAccess = useShowPriorityAccessDialog();
  const translate = useTranslate();

  const openImportDialog = useCallback(() => {
    setDialogState({ type: "importZones" });
  }, [setDialogState]);

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

        const hasExistingZones = Object.keys(zones).length > 0;

        if (hasExistingZones) {
          setDialogState({
            type: "importZonesWarning",
            onContinue: openImportDialog,
          });
        } else {
          openImportDialog();
        }
      });
    },
    [
      setDialogState,
      zones,
      userTracking,
      onlyEarlyAccess,
      canUseZones,
      showPriorityAccess,
      translate,
      openImportDialog,
    ],
  );

  return importZones;
};
