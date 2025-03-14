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
import { MODE_INFO } from "src/state/mode";
import {
  showSortcutsShortcut,
  useShowShortcuts,
} from "src/commands/show-shortcuts";
import {
  deleteSelectedShortcuts,
  useDeleteSelectedAssets,
} from "src/commands/delete-selected-assets";
import { selectAllShortcut, useSelectAll } from "src/commands/select-all";
import {
  openInpFromFsShortcut,
  useOpenInpFromFs,
} from "src/commands/open-inp-from-fs";

const IGNORE_ROLES = new Set(["menuitem"]);

export const CommandShortcuts = () => {
  const showReport = useShowReport();
  const runSimulation = useRunSimulation();
  const showShortcuts = useShowShortcuts();
  const createNew = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const saveInp = useSaveInp();
  const { undo, redo } = useHistoryControl();
  const userTracking = useUserTracking();
  const setDrawingMode = useDrawingMode();
  const deleteSelectedAssets = useDeleteSelectedAssets();
  const selectAll = useSelectAll();

  useHotkeys(
    showReportShorcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

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

      void openInpFromFs({ source: "shortcut" });
    },
    [openInpFromFsShortcut, openInpFromFs],
    "Open inp",
  );

  useHotkeys(
    createNewShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "newModel.started",
        source: "shortcut",
      });
      void createNew();
    },
    [createNewShortcut, createNew],
    "Open inp",
  );

  useHotkeys(
    saveShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "model.saved",
        source: "shortcut",
      });
      void saveInp();
    },
    [saveShortcut, saveInp],
    "Save",
  );

  useHotkeys(
    saveAsShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "model.saved",
        source: "shortcut",
        isSaveAs: true,
      });
      void saveInp({ isSaveAs: true });
    },
    [saveAsShortcut, saveInp],
    "Save",
  );

  useHotkeys(
    undoShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "operation.undone",
        source: "shortcut",
      });
      void undo();
    },
    [undoShortcut, undo],
    "Undo",
  );

  useHotkeys(
    redoShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "operation.redone",
        source: "shortcut",
      });
      void redo();
    },
    [redoShortcut, redo],
    "Redo",
  );

  useHotkeys(
    redoShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "operation.redone",
        source: "shortcut",
      });
      void redo();
    },
    [redoShortcut, redo],
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

      e.preventDefault();
      void deleteSelectedAssets({ source: "shortcut" });
    },
    [deleteSelectedAssets],
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

  for (const [shortcut, mode] of Object.entries(drawingModeShorcuts)) {
    // eslint-disable-next-line
    useHotkeys(
      shortcut,
      (e) => {
        if (e.preventDefault) e.preventDefault();

        userTracking.capture({
          name: "drawingMode.enabled",
          source: "shortcut",
          type: MODE_INFO[mode].name,
        });
        void setDrawingMode(mode);
      },
      [shortcut, mode, setDrawingMode],
      `Set ${mode} mode`,
    );
  }

  return null;
};
