import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";
import { DialogContainer, DialogHeader } from "../dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { MapPinnedIcon } from "src/icons";

export const InpProjectionChoiceDialog = ({
  onImportNonProjected,
}: {
  onImportNonProjected: () => void;
}) => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

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
      <DialogHeader
        title="Is this network projected?"
        titleIcon={MapPinnedIcon}
      />
      <p className="text-sm text-gray-700 dark:text-gray-300 pb-4">
        We couldn&apos;t detect a coordinate system for this network. Please
        specify how the coordinates should be handled:
      </p>

      <div className="grid grid-cols-2 gap-3 pb-2">
        <button
          type="button"
          onClick={handleNonProjected}
          className="text-left cursor-pointer rounded-md p-3 border-2 border-gray-200 bg-white hover:border-purple-500 hover:bg-purple-50 dark:bg-transparent dark:border-gray-700 dark:hover:border-purple-500 dark:hover:bg-purple-950 transition-colors"
        >
          <div className="w-full h-24 bg-gray-100 dark:bg-gray-800 rounded mb-2 flex items-center justify-center text-gray-400 text-xs">
            [image placeholder]
          </div>
          <div className="font-medium text-gray-900 dark:text-gray-100">
            Non-Projected (XY)
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            The coordinates are simple X and Y values for a standalone diagram.
          </div>
        </button>

        <button
          type="button"
          onClick={handleProjected}
          className="text-left cursor-pointer rounded-md p-3 border-2 border-gray-200 bg-white hover:border-purple-500 hover:bg-purple-50 dark:bg-transparent dark:border-gray-700 dark:hover:border-purple-500 dark:hover:bg-purple-950 transition-colors"
        >
          <div className="w-full h-24 bg-gray-100 dark:bg-gray-800 rounded mb-2 flex items-center justify-center text-gray-400 text-xs">
            [image placeholder]
          </div>
          <div className="font-medium text-gray-900 dark:text-gray-100">
            Projected
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            The coordinates align with a specific map zone.
          </div>
        </button>
      </div>
    </DialogContainer>
  );
};
