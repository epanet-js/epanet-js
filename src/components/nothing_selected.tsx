import {
  DownloadIcon,
  FilePlusIcon,
  VercelLogoIcon,
  StretchHorizontallyIcon,
  CursorArrowIcon,
  LightningBoltIcon,
  AspectRatioIcon,
  KeyboardIcon,
  ResetIcon,
  CircleIcon,
} from "@radix-ui/react-icons";
import { memo } from "react";
import { Button } from "./elements";
import { localizeKeybinding, translate } from "src/infra/i18n";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog_state";
import { useOpenInp } from "src/commands/open-inp";
import { useSaveInp } from "src/commands/save-inp";

export const NothingSelected = memo(function NothingSelected() {
  const { openInpFromFs } = useOpenInp();
  const saveInp = useSaveInp();
  const setDialogState = useSetAtom(dialogAtom);

  return (
    <div className="px-3 pt-3 overflow-y-auto pb-4 text-gray-900 dark:text-gray-300 flex-auto placemark-scrollbar">
      <div className="text-sm font-semibold pb-2">
        {translate("onboardingSelectDrawing", "")}
      </div>
      <div
        className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        <div className="pt-1">
          <VercelLogoIcon />
        </div>
        <div>{translate("onboardingDrawReservoir")}</div>
        <div className="pt-1">
          <CircleIcon />
        </div>
        <div>{translate("onboardingDrawJunctions")}</div>
        <div className="pt-1">
          <StretchHorizontallyIcon />
        </div>
        <div>{translate("onboardingDrawPipe")}</div>
        <div className="pt-1">
          <CursorArrowIcon />
        </div>
        <div>{translate("onboardingSelectAsset")}</div>
      </div>
      <div className="pt-4 space-y-3">
        <div className="text-sm font-semibold pb-2">
          {translate("onboardingRunningModel")}
        </div>
      </div>
      <div
        className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        <div className="pt-1">
          <LightningBoltIcon />
        </div>
        <div>{translate("onboardingRunSimulation")}</div>
        <div className="pt-1">
          <AspectRatioIcon />
        </div>
        <div>{translate("onboardingAnalysis")}</div>
      </div>
      <div className="pt-4 space-y-3">
        <div className="text-sm font-semibold pb-2">
          {translate("onboardingOtherFeatures")}
        </div>
      </div>
      <div
        className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        <div className="pt-1">
          <KeyboardIcon />
        </div>
        <a
          href="#"
          className="!text-purple-800 hover:underline cursor:pointer"
          onClick={() => setDialogState({ type: "cheatsheet" })}
        >
          {translate("keyboardShortcuts")}
        </a>
        <div className="pt-1">
          <ResetIcon />
        </div>
        <div>
          {translate(
            "onboardingUndoRedo",
            localizeKeybinding("ctrl+z"),
            localizeKeybinding("ctrl+y"),
          )}
        </div>
      </div>
      <div className="pt-4 space-y-3">
        <div className="text-sm font-semibold pb-2">
          {translate("onboardingFiles")}
        </div>
        <div className="flex items-center gap-x-2">
          <Button
            type="button"
            onClick={() => {
              void openInpFromFs();
            }}
          >
            <FilePlusIcon />
            {translate("openProject")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              void saveInp();
            }}
          >
            <DownloadIcon />
            {translate("save")}
          </Button>
        </div>
      </div>
    </div>
  );
});
