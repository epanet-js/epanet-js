import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import { SimulationProgressDialogState } from "src/state/dialog";
import { useTranslate } from "src/hooks/use-translate";
import {
  DefaultErrorBoundary,
  StyledDialogContent,
  StyledDialogOverlay,
} from "../elements";

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

export const SimulationProgressDialog = ({
  modal,
}: {
  modal: SimulationProgressDialogState;
}) => {
  const translate = useTranslate();
  const { currentTime, totalDuration } = modal;
  const progressPercent =
    totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <Dialog.Root open={true}>
      <Dialog.Trigger className="hidden">
        <div className="hidden"></div>
      </Dialog.Trigger>
      <Dialog.Portal>
        <StyledDialogOverlay />
        <Dialog.Title></Dialog.Title>
        <Dialog.Description></Dialog.Description>
        <StyledDialogContent
          size="xs"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DefaultErrorBoundary>
            <div className="flex flex-row items-baseline gap-1 mb-2">
              <p className="text-sm text-gray-500">
                {translate("runningSimulation")}
              </p>
              <p className="text-sm font-bold text-gray-900 tabular-nums">
                {formatTime(currentTime)}
              </p>
            </div>

            <Progress.Root
              className="relative overflow-hidden bg-gray-200 rounded-full w-full h-2"
              value={currentTime}
              max={totalDuration}
            >
              <Progress.Indicator
                className="bg-purple-500 w-full h-full transition-transform duration-300 ease-out"
                style={{
                  transform: `translateX(-${100 - progressPercent}%)`,
                }}
              />
            </Progress.Root>
          </DefaultErrorBoundary>
        </StyledDialogContent>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
