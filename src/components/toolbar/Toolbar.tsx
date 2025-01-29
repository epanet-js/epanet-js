import { translate } from "src/infra/i18n";
import MenuAction from "../menu_action";
import {
  CopyIcon,
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
import { useSetAtom } from "jotai";
import { Mode, modeAtom } from "src/state/mode";
import { usePersistence } from "src/lib/persistence/context";
import { ephemeralStateAtom } from "src/state/jotai";
import { useOpenInp } from "src/hooks/use-open-inp";
import { useSaveInp } from "src/hooks/use-save-inp";

export const Toolbar = () => {
  const openInp = useOpenInp();
  const saveInp = useSaveInp();

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

  const handleSave = () => {
    saveInp();
  };

  const handleSaveAs = () => {
    saveInp({ isSaveAs: true });
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
        label={translate("save")}
        role="button"
        onClick={handleSave}
        hotkey={"ctrl+s"}
      >
        <DownloadIcon />
      </MenuAction>
      <MenuAction
        label={translate("saveAs")}
        role="button"
        onClick={handleSaveAs}
        hotkey={"ctrl+shift+s"}
      >
        <CopyIcon />
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
