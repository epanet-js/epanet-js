import { atom } from "jotai";
import { MomentLog } from "src/lib/persistence/moment-log";
import { fileInfoAtom } from "src/state/file-system";
import { stagingModelAtom } from "src/state/hydraulic-model";

export const momentLogAtom = atom<MomentLog>(new MomentLog());

export const hasUnsavedChangesAtom = atom<boolean>((get) => {
  const fileInfo = get(fileInfoAtom);
  const momentLog = get(momentLogAtom);
  const hydraulicModel = get(stagingModelAtom);

  if (fileInfo) {
    return fileInfo.modelVersion !== hydraulicModel.version;
  }

  return momentLog.getDeltas().length > 0;
});
