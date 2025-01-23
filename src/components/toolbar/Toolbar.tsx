import { translate } from "src/infra/i18n";
import MenuAction from "../menu_action";
import { DownloadIcon, FileIcon, FilePlusIcon } from "@radix-ui/react-icons";
import Modes from "../modes";
import {
  SimulationButton,
  SimulationStatusText,
} from "../simulation-components";
import ContextActions from "../context_actions";
import { Visual } from "../visual";
import { useOpenFiles } from "src/hooks/use_open_files";
import useFileSave from "src/hooks/use_file_save";
import toast from "react-hot-toast";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog_state";

export const Toolbar = () => {
  const openFiles = useOpenFiles();
  const saveNative = useFileSave();
  const setDialogState = useSetAtom(dialogAtom);

  const handleExport = async () => {
    const either = await saveNative();
    return either
      .ifLeft((error) => toast.error(error?.message || "Could not save"))
      .map((saved) => {
        if (saved) return;
        setDialogState({
          type: "export",
        });
      });
  };

  return (
    <div
      className="flex flex-row items-center justify-start overflow-x-auto sm:overflow-visible
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
        onClick={() => {
          openFiles();
        }}
        hotkey={"ctrl+o"}
      >
        <FilePlusIcon />
      </MenuAction>
      <MenuAction
        label={translate("export")}
        role="button"
        onClick={handleExport}
        hotkey={"ctrl+s"}
      >
        <DownloadIcon />
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
  return <div className="border-r-2 border-gray-100 h-8 mx-2"></div>;
};
