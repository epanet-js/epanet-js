import * as Progress from "@radix-ui/react-progress";
import {
  OpenProjectPhase,
  OpenProjectProgressDialogState,
} from "src/state/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { BaseDialog } from "../components/dialog";

const phaseTranslationKey = (phase: OpenProjectPhase): string => {
  switch (phase) {
    case "opening":
      return "openProjectProgress.opening";
    case "reading-assets":
      return "openProjectProgress.readingAssets";
    case "reading-customer-points":
      return "openProjectProgress.readingCustomerPoints";
    case "reading-settings":
      return "openProjectProgress.readingSettings";
    case "building":
      return "openProjectProgress.building";
    case "finalizing":
      return "openProjectProgress.finalizing";
  }
};

const phasePercent = (phase: OpenProjectPhase): number => {
  switch (phase) {
    case "opening":
      return 5;
    case "reading-assets":
      return 40;
    case "reading-customer-points":
      return 75;
    case "reading-settings":
      return 80;
    case "building":
      return 95;
    case "finalizing":
      return 100;
  }
};

export const OpenProjectProgressDialog = ({
  modal,
}: {
  modal: OpenProjectProgressDialogState;
}) => {
  const translate = useTranslate();
  const label = translate(phaseTranslationKey(modal.phase));
  const percent = phasePercent(modal.phase);

  return (
    <BaseDialog size="sm" isOpen={true} onClose={() => {}} preventClose={true}>
      <div className="p-6 flex flex-col gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-2">{label}</p>
          <Progress.Root
            className="relative overflow-hidden bg-gray-200 rounded-full w-full h-2"
            value={percent}
            max={100}
          >
            <Progress.Indicator
              className="relative overflow-hidden bg-purple-500 w-full h-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${100 - percent}%)` }}
            >
              <div className="absolute inset-y-0 left-0 w-1/3 progress-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </Progress.Indicator>
          </Progress.Root>
        </div>
      </div>
    </BaseDialog>
  );
};
