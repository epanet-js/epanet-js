import { useTranslate } from "src/hooks/use-translate";
import MenuAction from "../menu-action";
import {
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Redo2,
  Settings,
  Undo2,
  Zap,
} from "lucide-react";
import {
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  GearIcon,
  LightningBoltIcon,
  ResetIcon,
} from "@radix-ui/react-icons";
import Modes from "../modes";
import ContextActions from "../context-actions";
import { useAtomValue } from "jotai";
import { simulationAtom } from "src/state/jotai";
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
import {
  showSimulationSettingsShortcut,
  useShowSimulationSettings,
} from "src/commands/show-simulation-settings";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useImportCustomerPoints } from "src/commands/import-customer-points";
import { CreateNewDropdown } from "./create-new-dropdown";

export const Toolbar = () => {
  const translate = useTranslate();
  const saveInp = useSaveInp();
  const userTracking = useUserTracking();
  const runSimulation = useRunSimulation();
  const showSimulationSettings = useShowSimulationSettings();
  const showReport = useShowReport();
  const importCustomerPoints = useImportCustomerPoints();

  const { undo, redo } = useHistoryControl();

  const isCustomerPointOn = useFeatureFlag("FLAG_CUSTOMER_POINT");
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  const simulation = useAtomValue(simulationAtom);

  const isMdOrLarger = useBreakpoint("md");

  return (
    <div
      className="relative flex flex-row items-center justify-start overflow-x-auto sm:overflow-visible
          border-t border-gray-200 dark:border-gray-900 pl-2 h-12"
    >
      <CreateNewDropdown />
      {
        <>
          <MenuAction
            label={translate("save")}
            role="button"
            onClick={() => {
              void saveInp({ source: "toolbar" });
            }}
            readOnlyHotkey={saveShortcut}
          >
            {isLucideIconsOn ? <Download size={16} /> : <DownloadIcon />}
          </MenuAction>
          <MenuAction
            label={translate("saveAs")}
            role="button"
            onClick={() => {
              void saveInp({ source: "toolbar", isSaveAs: true });
            }}
            readOnlyHotkey={saveAsShortcut}
          >
            {isLucideIconsOn ? <Copy size={16} /> : <CopyIcon />}
          </MenuAction>
        </>
      }
      {isCustomerPointOn && (
        <MenuAction
          label={translate("importCustomerPoints.label")}
          role="button"
          onClick={() => {
            void importCustomerPoints({ source: "toolbar" });
          }}
        >
          {isLucideIconsOn ? <FileSpreadsheet size={16} /> : <FileTextIcon />}
        </MenuAction>
      )}
      <Divider />
      {isMdOrLarger && (
        <>
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
            {isLucideIconsOn ? <Undo2 size={16} /> : <ResetIcon />}
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
            {isLucideIconsOn ? (
              <Redo2 size={16} />
            ) : (
              <ResetIcon className="scale-x-[-1]" />
            )}
          </MenuAction>
          <Divider />
        </>
      )}
      {isMdOrLarger && (
        <>
          <Modes replaceGeometryForId={null} />
          <Divider />
        </>
      )}
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
        {isLucideIconsOn ? (
          <Zap size={16} />
        ) : (
          <LightningBoltIcon className="text-yellow-600" />
        )}
      </MenuAction>
      <MenuAction
        label={translate("simulationSettings")}
        role="button"
        onClick={() => showSimulationSettings({ source: "toolbar" })}
        readOnlyHotkey={showSimulationSettingsShortcut}
      >
        {isLucideIconsOn ? <Settings size={16} /> : <GearIcon />}
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
        {isLucideIconsOn ? <FileText size={16} /> : <FileTextIcon />}
      </MenuAction>
      <Divider />
      {isMdOrLarger && (
        <>
          <ContextActions />
          <div className="flex-auto" />
        </>
      )}
    </div>
  );
};

const Divider = () => {
  return <div className="border-r-2 border-gray-100 h-8 mx-1"></div>;
};
