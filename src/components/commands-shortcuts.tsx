import { useHotkeys } from "src/keyboard/hotkeys";
import { showReportShorcut, useShowReport } from "src/commands/show-report";
import { useUserTracking } from "src/infra/user-tracking";
import {
  runSimulationShortcut,
  useRunSimulation,
} from "src/commands/run-simulation";
import {
  createNewShortcut,
  useNewProject,
} from "src/commands/create-new-project";
import {
  saveAsShortcut,
  saveShortcut,
  useSaveInp,
} from "src/commands/save-inp";
import {
  redoShortcut,
  undoShortcut,
  useHistoryControl,
} from "src/commands/history-control";
import {
  drawingModeShorcuts,
  useDrawingMode,
} from "src/commands/set-drawing-mode";
import { MODE_INFO, Mode, modeAtom } from "src/state/mode";
import { profileViewAtom } from "src/state/profile-view";
import { ephemeralStateAtom } from "src/state/drawing";
import {
  showSortcutsShortcut,
  useShowShortcuts,
} from "src/commands/show-shortcuts";
import {
  deleteSelectedShortcuts,
  useDeleteSelection,
} from "src/commands/delete-selection";
import { selectAllShortcut, useSelectAll } from "src/commands/select-all";
import {
  openInpFromFsShortcut,
  useOpenInpFromFs,
} from "src/commands/open-inp-from-fs";
import { useOpenProject } from "src/commands/open-project";
import { useSaveProject } from "src/commands/save-project";
import {
  toggleSatelliteShorcut,
  useToggleSatellite,
} from "src/commands/toggle-satellite";
import { useAtomValue, useSetAtom } from "jotai";
import {
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import {
  showSimulationSettingsShortcut,
  useShowSimulationSettings,
} from "src/commands/show-simulation-settings";
import {
  connectCustomersShortcut,
  disconnectCustomersShortcut,
  useConnectCustomerPoints,
  useDisconnectCustomerPoints,
} from "src/commands/customer-point-actions";
import {
  redrawModeShortcut,
  useSetRedrawMode,
} from "src/commands/set-redraw-mode";
import { reverseLinkShortcut, useReverseLink } from "src/commands/reverse-link";
import {
  toggleNetworkReviewShortcut,
  useToggleNetworkReview,
} from "src/commands/toggle-network-review";
import {
  toggleSidePanelShortcut,
  useToggleSidePanel,
} from "src/commands/toggle-side-panel";
import {
  useCycleSelectionMode,
  selectionModeShortcut,
} from "src/commands/set-area-selection-mode";
import {
  useCycleTraceSelectMode,
  traceSelectModeShortcut,
} from "src/commands/set-trace-select-mode";
import {
  changeActiveTopologyShortcut,
  useChangeSelectedAssetsActiveTopologyStatus,
} from "src/commands/change-selected-assets-active-topology-status";
import {
  showControlsShortcut,
  useShowControls,
} from "src/commands/show-controls";
import {
  previousTimestepShortcut,
  nextTimestepShortcut,
  useChangeTimestep,
} from "src/commands/change-timestep";
import {
  togglePlaybackShortcut,
  useTogglePlayback,
} from "src/commands/toggle-playback";
import {
  toggleBranchShortcut,
  goToMainShortcut,
  useToggleBranch,
  useGoToMain,
} from "src/commands/scenario-shortcuts";
import {
  createScenarioShortcut,
  useCreateScenario,
} from "src/commands/create-scenario";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

const IGNORE_ROLES = new Set(["menuitem"]);

export const CommandShortcuts = () => {
  const showReport = useShowReport();
  const runSimulation = useRunSimulation();
  const showShortcuts = useShowShortcuts();
  const createNew = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const openProject = useOpenProject();
  const saveInp = useSaveInp();
  const saveProject = useSaveProject();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");
  const { undo, redo } = useHistoryControl();
  const userTracking = useUserTracking();
  const setDrawingMode = useDrawingMode();
  const deleteSelection = useDeleteSelection();
  const selectAll = useSelectAll();
  const toggleSatellite = useToggleSatellite();
  const showSimulationSettings = useShowSimulationSettings();
  const connectCustomerPoints = useConnectCustomerPoints();
  const disconnectCustomerPoints = useDisconnectCustomerPoints();
  const setRedrawMode = useSetRedrawMode();
  const reverseLinkAction = useReverseLink();
  const simulation = useAtomValue(simulationDerivedAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const toggleNetworkReview = useToggleNetworkReview();
  const toggleSidePanel = useToggleSidePanel();
  const cycleSelectionMode = useCycleSelectionMode();
  const cycleTraceSelectMode = useCycleTraceSelectMode();
  const { changeSelectedAssetsActiveTopologyStatus } =
    useChangeSelectedAssetsActiveTopologyStatus();
  const showControls = useShowControls();
  const { goToPreviousTimestep, goToNextTimestep } = useChangeTimestep();
  const { togglePlayback } = useTogglePlayback();
  const isAnimateSimulationOn = useFeatureFlag("FLAG_ANIMATE_SIMULATION");
  const isProfileViewOn = useFeatureFlag("FLAG_PROFILE_VIEW");
  const isEditionBlocked = useIsEditionBlocked();
  const createScenario = useCreateScenario();
  const toggleBranch = useToggleBranch();
  const goToMain = useGoToMain();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setProfileEphemeral = useSetAtom(ephemeralStateAtom);

  useHotkeys(
    showReportShorcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();
      if (simulation.status === "idle") return;

      void showReport({ source: "shortcut" });
    },
    [showReportShorcut, showReport],
    "Show report",
  );

  useHotkeys(
    runSimulationShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "simulation.executed",
        source: "shortcut",
        qualityType: simulationSettings.qualitySimulationType,
      });
      void runSimulation();
    },
    [runSimulationShortcut, runSimulation],
    "Run simulation",
  );

  useHotkeys(
    openInpFromFsShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      if (isOurFileOn) {
        openProject({ source: "shortcut" });
      } else {
        void openInpFromFs({ source: "shortcut" });
      }
    },
    [openInpFromFsShortcut, openInpFromFs, openProject, isOurFileOn],
    "Open inp",
  );

  useHotkeys(
    createNewShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      void createNew({ source: "shortcut" });
    },
    [createNewShortcut, createNew],
    "Open inp",
  );

  useHotkeys(
    saveShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      if (isOurFileOn) {
        void saveProject({ source: "shortcut" });
      } else {
        void saveInp({ source: "shortcut" });
      }
    },
    [saveShortcut, saveInp, saveProject, isOurFileOn],
    "Save",
  );

  useHotkeys(
    saveAsShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      if (isOurFileOn) {
        void saveProject({ source: "shortcut", isSaveAs: true });
      } else {
        void saveInp({ source: "shortcut", isSaveAs: true });
      }
    },
    [saveAsShortcut, saveInp, saveProject, isOurFileOn],
    "Save",
  );

  useHotkeys(
    undoShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();
      if (isEditionBlocked) return;

      userTracking.capture({
        name: "operation.undone",
        source: "shortcut",
      });
      void undo();
    },
    [undoShortcut, undo, isEditionBlocked],
    "Undo",
  );

  useHotkeys(
    redoShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();
      if (isEditionBlocked) return;

      userTracking.capture({
        name: "operation.redone",
        source: "shortcut",
      });
      void redo();
    },
    [redoShortcut, redo, isEditionBlocked],
    "Redo",
  );

  useHotkeys(
    redoShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();
      if (isEditionBlocked) return;

      userTracking.capture({
        name: "operation.redone",
        source: "shortcut",
      });
      void redo();
    },
    [redoShortcut, redo, isEditionBlocked],
    "Redo",
  );

  useHotkeys(
    showSortcutsShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "shortcuts.opened",
        source: "shortcut",
      });
      void showShortcuts();
    },
    [showSortcutsShortcut, showShortcuts],
    "Show shortcuts",
  );

  useHotkeys(
    deleteSelectedShortcuts,
    (e) => {
      if (IGNORE_ROLES.has((e.target as HTMLElement).getAttribute("role")!))
        return;
      if (isEditionBlocked) return;

      e.preventDefault();
      void deleteSelection({ source: "shortcut" });
    },
    [deleteSelection, isEditionBlocked],
    "DELETE",
  );

  useHotkeys(
    selectAllShortcut,
    (e) => {
      e.preventDefault();
      void selectAll({ source: "shortcut" });
    },
    [selectAll],
    "SELECT_ALL",
  );

  useHotkeys(
    toggleSatelliteShorcut,
    (e) => {
      e.preventDefault();
      userTracking.capture({
        name: "satelliteView.toggled",
        source: "shortcut",
      });
      toggleSatellite();
    },
    [toggleSatellite],
    `Toggle satellite`,
  );

  useHotkeys(
    showSimulationSettingsShortcut,
    (e) => {
      e.preventDefault();
      showSimulationSettings({ source: "shortcut" });
    },
    [showSimulationSettings],
    `Show simulaton settings`,
  );

  useHotkeys(
    showControlsShortcut,
    (e) => {
      e.preventDefault();
      showControls({ source: "shortcut" });
    },
    [showControls],
    `Show controls`,
  );

  useHotkeys(
    connectCustomersShortcut,
    (e) => {
      e.preventDefault();
      if (isEditionBlocked) return;
      connectCustomerPoints({ source: "shortcut" });
    },
    [connectCustomerPoints, isEditionBlocked],
    "Connect/Reconnect customer points",
  );

  useHotkeys(
    disconnectCustomersShortcut,
    (e) => {
      e.preventDefault();
      if (isEditionBlocked) return;
      disconnectCustomerPoints({ source: "shortcut" });
    },
    [disconnectCustomerPoints, isEditionBlocked],
    "Disconnect customer points",
  );

  useHotkeys(
    redrawModeShortcut,
    (e) => {
      e.preventDefault();
      if (isEditionBlocked) return;
      setRedrawMode({ source: "shortcut" });
    },
    [setRedrawMode, isEditionBlocked],
    "Set redraw mode",
  );

  useHotkeys(
    reverseLinkShortcut,
    (e) => {
      e.preventDefault();
      if (isEditionBlocked) return;
      reverseLinkAction({ source: "shortcut" });
    },
    [reverseLinkAction, isEditionBlocked],
    "Reverse link",
  );

  useHotkeys(
    toggleNetworkReviewShortcut,
    (e) => {
      e.preventDefault();
      toggleNetworkReview({ source: "shortcut" });
    },
    [toggleNetworkReview],
    "Toggle network review",
  );

  useHotkeys(
    toggleSidePanelShortcut,
    (e) => {
      e.preventDefault();
      toggleSidePanel({ source: "shortcut" });
    },
    [toggleSidePanel],
    "Toggle side panel",
  );

  useHotkeys(
    selectionModeShortcut,
    (e) => {
      e.preventDefault();
      const mode = cycleSelectionMode();
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "shortcut",
        type: MODE_INFO[mode as Mode].name,
      });
    },
    [cycleSelectionMode],
    "Set selection mode",
  );

  useHotkeys(
    traceSelectModeShortcut,
    (e) => {
      e.preventDefault();
      const mode = cycleTraceSelectMode();
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "shortcut",
        type: MODE_INFO[mode as Mode].name,
      });
    },
    [cycleTraceSelectMode],
    "Set trace select mode",
  );

  useHotkeys(
    changeActiveTopologyShortcut,
    (e) => {
      e.preventDefault();
      if (isEditionBlocked) return;
      changeSelectedAssetsActiveTopologyStatus({ source: "shortcut" });
    },
    [changeSelectedAssetsActiveTopologyStatus, isEditionBlocked],
    "Activate/Deactivate assets",
  );

  useHotkeys(
    previousTimestepShortcut,
    (e) => {
      e.preventDefault();
      goToPreviousTimestep("shortcut");
    },
    [goToPreviousTimestep],
    "Previous timestep",
  );

  useHotkeys(
    nextTimestepShortcut,
    (e) => {
      e.preventDefault();
      goToNextTimestep("shortcut");
    },
    [goToNextTimestep],
    "Next timestep",
  );

  useHotkeys(
    togglePlaybackShortcut,
    (e) => {
      e.preventDefault();
      togglePlayback("shortcut");
    },
    [togglePlayback],
    "Play/pause simulation",
    !isAnimateSimulationOn,
  );

  useHotkeys(
    createScenarioShortcut,
    (e) => {
      e.preventDefault();
      createScenario({ source: "shortcut" });
    },
    [createScenario],
    "Create new scenario",
  );

  useHotkeys(
    toggleBranchShortcut,
    (e) => {
      e.preventDefault();
      userTracking.capture({
        name: "scenario.toggled",
        source: "shortcut",
      });
      toggleBranch();
    },
    [toggleBranch],
    "Toggle snapshot",
  );

  useHotkeys(
    goToMainShortcut,
    (e) => {
      e.preventDefault();
      userTracking.capture({
        name: "scenario.switched",
        scenarioId: null,
        scenarioName: "Main",
      });
      goToMain();
    },
    [goToMain],
    "Go to main",
  );

  useHotkeys(
    "9",
    (e) => {
      if (e.preventDefault) e.preventDefault();
      if (currentMode === Mode.PROFILE_VIEW) {
        setProfileView({ phase: "idle" });
        setProfileEphemeral({ type: "none" });
        void setDrawingMode(Mode.NONE);
      } else {
        setProfileView({ phase: "selectingStart" });
        setProfileEphemeral({ type: "profileView" });
        setMode({ mode: Mode.PROFILE_VIEW });
      }
    },
    [currentMode, setProfileView, setProfileEphemeral, setDrawingMode, setMode],
    "Profile view mode",
    !isProfileViewOn,
  );

  for (const [mode, shortcut] of Object.entries(drawingModeShorcuts)) {
    // eslint-disable-next-line
    useHotkeys(
      shortcut,
      (e) => {
        if (e.preventDefault) e.preventDefault();
        if (isEditionBlocked) return;

        userTracking.capture({
          name: "drawingMode.enabled",
          source: "shortcut",
          type: MODE_INFO[mode as Mode].name,
        });
        void setDrawingMode(mode as Mode);
      },
      [shortcut, mode, setDrawingMode, isEditionBlocked],
      `Set ${mode} mode`,
    );
  }

  return null;
};
