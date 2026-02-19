import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";
import { DialogContainer, DialogHeader } from "../dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import NetworkUnprojectedIllustration from "./network-projection/network-unprojected";
import NetworkProjectedIllustration from "./network-projection/network-projected";

export const InpProjectionChoiceDialog = ({
  onImportNonProjected,
}: {
  onImportNonProjected: () => void;
}) => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();

  const handleProjected = () => {
    userTracking.capture({ name: "inpProjectionChoice.projected" });
    setDialogState({
      type: "inpGeocodingNotSupported",
      onImportNonProjected,
    });
  };

  const handleNonProjected = () => {
    userTracking.capture({ name: "inpProjectionChoice.nonProjected" });
    onImportNonProjected();
  };

  return (
    <DialogContainer size="sm">
      <DialogHeader title={translate("inpProjectionChoice.title")} />
      <p className="text-sm text-gray-700 dark:text-gray-300 pb-4">
        {translate("inpProjectionChoice.description")}
      </p>

      <div className="grid grid-cols-2 gap-3 pb-2">
        <button
          type="button"
          onClick={handleNonProjected}
          className="text-left cursor-pointer rounded-lg border border-gray-200 bg-white hover:border-purple-500 hover:bg-purple-50 dark:bg-transparent dark:border-gray-700 dark:hover:border-purple-500 dark:hover:bg-purple-950 transition-colors overflow-hidden"
        >
          <div className="w-full border-b border-gray-200">
            <NetworkUnprojectedIllustration />
          </div>
          <div className="p-3">
            <p className="font-bold text-gray-900 dark:text-gray-100">
              {translate("inpProjectionChoice.nonProjectedTitle")}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {translate("inpProjectionChoice.nonProjectedDescription")}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={handleProjected}
          className="text-left cursor-pointer rounded-lg border border-gray-200 bg-white hover:border-purple-500 hover:bg-purple-50 dark:bg-transparent dark:border-gray-700 dark:hover:border-purple-500 dark:hover:bg-purple-950 transition-colors overflow-hidden"
        >
          <div className="w-full border-b border-gray-200">
            <NetworkProjectedIllustration />
          </div>
          <div className="p-3">
            <p className="font-bold text-gray-900 dark:text-gray-100">
              {translate("inpProjectionChoice.projectedTitle")}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {translate("inpProjectionChoice.projectedDescription")}
            </p>
          </div>
        </button>
      </div>
    </DialogContainer>
  );
};
