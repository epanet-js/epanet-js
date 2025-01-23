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

export const Toolbar = () => {
  return (
    <div
      className="flex flex-row items-center justify-start overflow-x-auto sm:overflow-visible
          border-t border-gray-200 dark:border-gray-900 pl-2 h-12"
    >
      <MenuAction
        label={translate("new")}
        role="button"
        onClick={() => {}}
        hotkey={"ctrl+n"}
      >
        <FileIcon />
      </MenuAction>
      <MenuAction
        label={translate("open")}
        role="button"
        onClick={() => {}}
        hotkey={"ctrl+o"}
      >
        <FilePlusIcon />
      </MenuAction>
      <MenuAction
        label={translate("open")}
        role="button"
        onClick={() => {}}
        hotkey={"ctrl+o"}
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
