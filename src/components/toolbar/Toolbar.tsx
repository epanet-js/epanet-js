import { translate } from "src/infra/i18n";
import MenuAction from "../menu_action";
import {
  CopyIcon,
  DownloadIcon,
  FileIcon,
  FilePlusIcon,
  FileTextIcon,
  LightningBoltIcon,
  ResetIcon,
} from "@radix-ui/react-icons";
import Modes from "../modes";
import ContextActions from "../context_actions";
import { Visual } from "../visual";
import { useAtomValue } from "jotai";
import { simulationAtom } from "src/state/jotai";
import {
  openInpFromFsShortcut,
  useOpenInpFromFs,
} from "src/commands/open-inp-from-fs";
import { useNewProject } from "src/commands/create-new-project";
import {
  saveAsShortcut,
  saveShortcut,
  useSaveInp,
} from "src/commands/save-inp";
import {
  runSimulationShortcut,
  useRunSimulation,
} from "src/commands/run-simulation";
import { useShowReport } from "src/commands/show-report";
import { useUserTracking } from "src/infra/user-tracking";
import { useHistoryControl } from "src/commands/history-control";

export const Toolbar = () => {
  const openInpFromFs = useOpenInpFromFs();
  const saveInp = useSaveInp();
  const createNewProject = useNewProject();
  const userTracking = useUserTracking();
  const runSimulation = useRunSimulation();
  const showReport = useShowReport();

  const { undo, redo } = useHistoryControl();

  const simulation = useAtomValue(simulationAtom);

  return (
    <div
      className="relative flex flex-row items-center justify-start overflow-x-auto sm:overflow-visible
          border-t border-gray-200 dark:border-gray-900 pl-2 h-12"
    >
      <MenuAction
        label={translate("newProject")}
        role="button"
        readOnlyHotkey={"alt+n"}
        onClick={() => {
          userTracking.capture({
            name: "newModel.started",
            source: "toolbar",
          });
          void createNewProject();
        }}
      >
        <FileIcon />
      </MenuAction>
      <MenuAction
        label={translate("openProject")}
        role="button"
        onClick={() => {
          userTracking.capture({
            name: "openModel.started",
            source: "toolbar",
          });
          void openInpFromFs();
        }}
        readOnlyHotkey={openInpFromFsShortcut}
      >
        <FilePlusIcon />
      </MenuAction>
      <MenuAction
        label={translate("save")}
        role="button"
        onClick={() => {
          userTracking.capture({
            name: "model.saved",
            source: "toolbar",
          });
          void saveInp();
        }}
        readOnlyHotkey={saveShortcut}
      >
        <DownloadIcon />
      </MenuAction>
      <MenuAction
        label={translate("saveAs")}
        role="button"
        onClick={() => {
          userTracking.capture({
            name: "model.saved",
            source: "toolbar",
            isSaveAs: true,
          });

          void saveInp({ isSaveAs: true });
        }}
        readOnlyHotkey={saveAsShortcut}
      >
        <CopyIcon />
      </MenuAction>
      <Divider />
      <MenuAction
        label={translate("undo")}
        role="button"
        onClick={() => {
          userTracking.capture({
            name: "operation.undone",
            source: "toolbar",
          });

          void undo();
        }}
        readOnlyHotkey={"ctrl+z"}
      >
        <ResetIcon />
      </MenuAction>
      <MenuAction
        label={translate("redo")}
        role="button"
        onClick={() => {
          userTracking.capture({
            name: "operation.redone",
            source: "toolbar",
          });
          void redo();
        }}
        readOnlyHotkey={"ctrl+y"}
      >
        <ResetIcon className="scale-x-[-1]" />
      </MenuAction>
      <Divider />
      <Modes replaceGeometryForId={null} />
      <Divider />
      <MenuAction
        label={translate("simulate")}
        role="button"
        onClick={() => {
          userTracking.capture({
            name: "simulation.executed",
            source: "toolbar",
          });
          void runSimulation();
        }}
        expanded={true}
        readOnlyHotkey={runSimulationShortcut}
      >
        <LightningBoltIcon className="text-yellow-600" />
      </MenuAction>
      <MenuAction
        label={translate("viewReport")}
        role="button"
        onClick={() => {
          showReport({ source: "toolbar" });
        }}
        readOnlyHotkey={"alt+r"}
        disabled={simulation.status === "idle"}
      >
        <FileTextIcon />
      </MenuAction>
      <Divider />
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
