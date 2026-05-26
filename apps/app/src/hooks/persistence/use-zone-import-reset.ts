import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import { mapSyncMomentAtom } from "src/state/map";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import { MomentLog } from "src/lib/persistence/moment-log";

type ZoneImportResetInput = {
  hydraulicModel: HydraulicModel;
};

export const useZoneImportReset = () => {
  const zoneImportReset = useAtomCallback(
    useCallback(
      (
        _get: unknown,
        set: Setter,
        { hydraulicModel }: ZoneImportResetInput,
      ) => {
        const momentLog = new MomentLog(hydraulicModel.version);

        set(stagingModelDerivedAtom, hydraulicModel);
        set(mapSyncMomentAtom, { pointer: -1, version: 0 });
        set(momentLogDerivedAtom, momentLog);
      },
      [],
    ),
  );

  return { zoneImportReset };
};
