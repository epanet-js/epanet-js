import { useTranslate } from "src/hooks/use-translate";
import MenuAction, { DisabledMenuAction } from "src/components/menu-action";
import {
  FileTextIcon,
  UndoIcon,
  RedoIcon,
  SettingsIcon,
  SaveIcon,
  SaveAllIcon,
  RunSimulationIcon,
  ImportCustomerPointsIcon,
  PanelBottomIcon,
  PanelBottomActiveIcon,
  PanelLeftIcon,
  PanelLeftActiveIcon,
  PanelRightActiveIcon,
  PanelRightIcon,
  SearchIcon,
} from "src/icons";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  mapToolbarPositionAtom,
  mapToolbarDockedAtom,
} from "src/state/map-toolbar-settings";
import type { MapToolbarPosition } from "src/state/map-toolbar-settings";
import { splitsAtom } from "src/state/layout";
import { commandBarOpenAtom } from "src/state/command-bar";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { opfsAvailableAtom } from "src/state/opfs";
import {
  canRedoDerivedAtom,
  canUndoDerivedAtom,
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import {
  saveAsShortcut,
  saveShortcut,
  useSaveInp,
} from "src/commands/save-inp";
import { useSaveProject } from "src/commands/save-project";
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
import { useImportCustomerPoints } from "src/commands/import-customer-points";
import { FileDropdown } from "./file-dropdown";
import { OperationalDataDropdown } from "./operational-data-dropdown";
import { AnalysisToolsDropdown } from "./analysis-tools-dropdown";
import {
  toggleNetworkReviewShortcut,
  useToggleNetworkReview,
} from "src/commands/toggle-network-review";
import {
  toggleSidePanelShortcut,
  useToggleSidePanel,
} from "src/commands/toggle-side-panel";
import {
  toggleBottomPanelShortcut,
  useToggleBottomPanel,
} from "src/commands/toggle-bottom-panel";

export const Toolbar = ({
  readonly = false,
  customerAllocationDisabled = false,
}: {
  readonly?: boolean;
  customerAllocationDisabled?: boolean;
}) => {
  const translate = useTranslate();
  const saveInp = useSaveInp();
  const saveProject = useSaveProject();
  const userTracking = useUserTracking();
  const runSimulation = useRunSimulation();
  const showSimulationSettings = useShowSimulationSettings();
  const showReport = useShowReport();
  const importCustomerPoints = useImportCustomerPoints();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");
  const isProfileViewOn = useFeatureFlag("FLAG_PROFILE_VIEW");
  const isOPFSAvailable = useAtomValue(opfsAvailableAtom);

  const { undo, redo } = useHistoryControl();

  const simulation = useAtomValue(simulationDerivedAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const canUndo = useAtomValue(canUndoDerivedAtom);
  const canRedo = useAtomValue(canRedoDerivedAtom);
  const isMdOrLarger = useBreakpoint("md");
  const isSmOrLarger = useBreakpoint("sm");

  return (
    <div
      className="relative flex flex-row items-center justify-between overflow-x-auto sm:overflow-visible
          border-t border-gray-200 dark:border-gray-900 px-2 h-12"
    >
      <div className="flex flex-row items-center justify-start">
        <FileDropdown />
        {isSmOrLarger && (
          <>
            <MenuAction
              label={translate("save")}
              role="button"
              onClick={() => {
                if (isOurFileOn) {
                  void saveProject({ source: "toolbar" });
                } else {
                  void saveInp({ source: "toolbar" });
                }
              }}
              readOnlyHotkey={saveShortcut}
            >
              <SaveIcon />
            </MenuAction>
            {!isOurFileOn && (
              <MenuAction
                label={translate("saveAs")}
                role="button"
                onClick={() => {
                  void saveInp({ source: "toolbar", isSaveAs: true });
                }}
                readOnlyHotkey={saveAsShortcut}
              >
                <SaveAllIcon />
              </MenuAction>
            )}
            <MenuAction
              label={translate("importCustomerPoints.label")}
              role="button"
              onClick={() => {
                void importCustomerPoints({ source: "toolbar" });
              }}
              disabled={customerAllocationDisabled}
            >
              <ImportCustomerPointsIcon />
            </MenuAction>
          </>
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
              disabled={readonly || !canUndo}
            >
              <UndoIcon />
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
              disabled={readonly || !canRedo}
            >
              <RedoIcon />
            </MenuAction>
            <Divider />
          </>
        )}
        {!isOPFSAvailable ? (
          <DisabledMenuAction
            label={translate("simulate")}
            reason={translate("simulateUnavailablePrivateBrowsing")}
          >
            <RunSimulationIcon className="stroke-yellow-600" />
          </DisabledMenuAction>
        ) : (
          <MenuAction
            label={translate("simulate")}
            role="button"
            onClick={() => {
              userTracking.capture({
                name: "simulation.executed",
                source: "toolbar",
                qualityType: simulationSettings.qualitySimulationType,
              });
              void runSimulation();
            }}
            expanded={true}
            readOnlyHotkey={runSimulationShortcut}
          >
            <RunSimulationIcon className="stroke-yellow-600" />
          </MenuAction>
        )}
        <MenuAction
          label={translate("simulationSettings.title")}
          role="button"
          onClick={() => showSimulationSettings({ source: "toolbar" })}
          readOnlyHotkey={showSimulationSettingsShortcut}
        >
          <SettingsIcon />
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
        <OperationalDataDropdown />
        {isProfileViewOn && <AnalysisToolsDropdown />}
      </div>
      <div className="flex flex-row items-center justify-end gap-2">
        <MapToolbarControls />
        <CommandBarButton />
        {isSmOrLarger && <LayoutActions />}
      </div>
    </div>
  );
};

const Divider = () => {
  return <div className="border-r-2 border-gray-100 h-8 mx-1"></div>;
};

const CommandBarButton = () => {
  const translate = useTranslate();
  const setOpen = useSetAtom(commandBarOpenAtom);
  const userTracking = useUserTracking();

  return (
    <MenuAction
      label={translate("assetSearch.placeholder")}
      role="button"
      onClick={() => {
        userTracking.capture({
          name: "commandBar.opened",
          source: "toolbar",
        });
        setOpen(true);
      }}
      readOnlyHotkey="ctrl+k"
    >
      <SearchIcon />
    </MenuAction>
  );
};

const LayoutActions = () => {
  const translate = useTranslate();
  const splits = useAtomValue(splitsAtom);
  const toggleNetworkReview = useToggleNetworkReview();
  const toggleBottomPanel = useToggleBottomPanel();
  const toggleSidePanel = useToggleSidePanel();

  const leftPanelIcon = splits.leftOpen ? (
    <PanelLeftActiveIcon />
  ) : (
    <PanelLeftIcon />
  );
  const bottomPanelIcon = splits.bottomOpen ? (
    <PanelBottomActiveIcon />
  ) : (
    <PanelBottomIcon />
  );
  const rightPanelIcon = splits.rightOpen ? (
    <PanelRightActiveIcon />
  ) : (
    <PanelRightIcon />
  );

  return (
    <>
      <MenuAction
        label={translate("networkReview.toggle")}
        role="button"
        onClick={() => {
          toggleNetworkReview({ source: "toolbar" });
        }}
        readOnlyHotkey={toggleNetworkReviewShortcut}
      >
        {leftPanelIcon}
      </MenuAction>

      <MenuAction
        label={translate("toggleBottomPanel")}
        role="button"
        onClick={() => {
          toggleBottomPanel({ source: "toolbar" });
        }}
        readOnlyHotkey={toggleBottomPanelShortcut}
      >
        {bottomPanelIcon}
      </MenuAction>

      <MenuAction
        label={translate("toggleSidePanel")}
        role="button"
        onClick={() => {
          toggleSidePanel({ source: "toolbar" });
        }}
        readOnlyHotkey={toggleSidePanelShortcut}
      >
        {rightPanelIcon}
      </MenuAction>
    </>
  );
};

const POSITION_OPTIONS: { value: MapToolbarPosition; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const MapToolbarControls = () => {
  const [position, setPosition] = useAtom(mapToolbarPositionAtom);
  const [docked, setDocked] = useAtom(mapToolbarDockedAtom);

  return (
    <div className="flex flex-row items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <select
        value={position}
        onChange={(e) => setPosition(e.target.value as MapToolbarPosition)}
        className="text-xs border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5
                   bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 cursor-pointer"
      >
        {POSITION_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 cursor-pointer select-none text-xs">
        <input
          type="checkbox"
          checked={docked}
          onChange={(e) => setDocked(e.target.checked)}
          className="w-3.5 h-3.5 cursor-pointer accent-purple-500"
        />
        Docked
      </label>
    </div>
  );
};
