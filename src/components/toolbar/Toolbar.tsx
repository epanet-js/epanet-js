import { translate } from "src/infra/i18n";
import MenuAction from "../menu_action";
import {
  DownloadIcon,
  FileIcon,
  FilePlusIcon,
  ResetIcon,
} from "@radix-ui/react-icons";
import Modes from "../modes";
import {
  SimulationButton,
  SimulationStatusText,
} from "../simulation-components";
import ContextActions from "../context_actions";
import { Visual } from "../visual";
import { useOpenInp } from "src/hooks/use_open_files";
import toast from "react-hot-toast";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog_state";
import { Mode, modeAtom } from "src/state/mode";
import { usePersistence } from "src/lib/persistence/context";
import { ephemeralStateAtom } from "src/state/jotai";
import { useFileSave, useFileSaveDeprecated } from "src/hooks/use_file_save";
import { isFeatureOn } from "src/infra/feature-flags";

const useFileSaveFn = isFeatureOn("FLAG_SAVE")
  ? useFileSave
  : useFileSaveDeprecated;

export const Toolbar = () => {
  const openInp = useOpenInp();
  const saveNative = useFileSaveFn();
  const setDialogState = useSetAtom(dialogAtom);

  const rep = usePersistence();
  const historyControl = rep.useHistoryControl();
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setMode = useSetAtom(modeAtom);

  const handleOpen = () => {
    openInp();
  };

  const handleUndo = () => {
    historyControl("undo");
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  };

  const handleRedo = () => {
    historyControl("redo");
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  };

  const handleExport = async () => {
    const either = await saveNative();
    return either
      .ifLeft((error) => toast.error(error?.message || "Could not save"))
      .map((saved) => {
        if (saved) return;
        setDialogState({
          type: isFeatureOn("FLAG_SAVE") ? "saveAs" : "export",
        });
      });
  };

  return (
    <div
      className="relative flex flex-row items-center justify-start overflow-x-auto sm:overflow-visible
          border-t border-gray-200 dark:border-gray-900 pl-2 h-12"
    >
      <MenuAction
        label={translate("newProject")}
        role="button"
        onClick={() => {
          window.location.reload();
        }}
      >
        <FileIcon />
      </MenuAction>
      <MenuAction
        label={translate("openProject")}
        role="button"
        onClick={handleOpen}
        hotkey={"ctrl+o"}
      >
        <FilePlusIcon />
      </MenuAction>
      <MenuAction
        label={
          isFeatureOn("FLAG_SAVE") ? translate("save") : translate("export")
        }
        role="button"
        onClick={handleExport}
        hotkey={"ctrl+s"}
      >
        <DownloadIcon />
      </MenuAction>
      <Divider />
      <MenuAction
        label={translate("undo")}
        role="button"
        onClick={handleUndo}
        hotkey={"ctrl+z"}
      >
        <ResetIcon />
      </MenuAction>
      <MenuAction
        label={translate("redo")}
        role="button"
        onClick={handleRedo}
        hotkey={"ctrl+y"}
      >
        <ResetIcon className="scale-x-[-1]" />
      </MenuAction>
      <Divider />
      <Modes replaceGeometryForId={null} />
      <Divider />
      <SimulationButton />
      <SimulationStatusText />
      <div className="flex-auto" />
      <ContextActions />
      <div className="flex-auto" />
      <div className="flex items-center space-x-2">
        <Visual />
      </div>
    </div>
  );
};

const Divider = () => {
  return <div className="border-r-2 border-gray-100 h-8 mx-1"></div>;
};
