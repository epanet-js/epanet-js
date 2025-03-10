import { PostHogProvider, usePostHog } from "posthog-js/react";
import { useCallback } from "react";
import { Asset } from "src/hydraulic-model";
import { isDebugOn } from "./debug-mode";
import { MODE_INFO } from "src/state/jotai";
type Metadata = {
  [key: string]: boolean | string | number | string[];
};

export const trackUserAction = (event: string, metadata: Metadata = {}) => {
  if (process.env.NEXT_PUBLIC_SKIP_USER_TRACKING === "true") return;

  // eslint-disable-next-line no-console
  console.log(`USER_TRACKING: ${event}`, metadata);
};

const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY as string;
const options = {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST as string,
};

export const UserTrackingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <PostHogProvider apiKey={apiKey} options={options}>
      {children}
    </PostHogProvider>
  );
};

type AssetCreated = {
  name: "asset.created";
  type: Asset["type"];
};

type AssetEdited = {
  name: "asset.edited";
  type: Asset["type"];
  property: string;
  newValue: string | number | null;
};

type AssetSelected = {
  name: "asset.selected";
  type: Asset["type"];
};

type MultiSelectUpdated = {
  name: "multiSelect.updated";
  count: number;
};

type FullSelectionEnabled = {
  name: "fullSelection.enabled";
  source: "shortcut";
};

type SelectionCleared = {
  name: "selection.cleared";
};

type AssetDeselected = {
  name: "asset.deselected";
  type: Asset["type"];
};

type AnalysisApplied = {
  name: "analysis.applied";
  type: "links" | "nodes";
  subtype: "none" | "flows" | "velocities" | "pressures";
};

type SatelliteViewToggled = {
  name: "satelliteView.toggled";
  source: "button" | "shortcut";
};

type AssetsDeleted = {
  name: "assets.deleted";
  source: "shortcut" | "toolbar" | "context-menu";
  count: number;
};

type WelcomeSeen = {
  name: "welcome.seen";
};

type WelcomeOpened = {
  name: "welcome.opened";
};

type WelcomeHidden = {
  name: "welcome.hidden";
};

type WelcomeEnabled = {
  name: "welcome.enabled";
};

type ExampleModelOpened = {
  name: "exampleModel.opened";
  modelName: string;
};

type SimulationExecuted = {
  name: "simulation.executed";
  source: "shortcut" | "toolbar";
};

type ReportOpened = {
  name: "report.opened";
  source: "shortcut" | "result-dialog" | "toolbar";
};

type OpenModelStarted = {
  name: "openModel.started";
  source: "shortcut" | "welcome" | "onboarding" | "toolbar";
};

type NewModelStarted = {
  name: "newModel.started";
  source: "shortcut" | "toolbar" | "welcome";
};

type ModelSaved = {
  name: "model.saved";
  source: "shortcut" | "toolbar" | "onboarding" | "unsaved-dialog";
  isSaveAs?: boolean;
};

type OperationUndone = {
  name: "operation.undone";
  source: "shortcut" | "toolbar";
};

type OperationRedone = {
  name: "operation.redone";
  source: "shortcut" | "toolbar";
};

type DrawingModeEnabled = {
  name: "drawingMode.enabled";
  source: "toolbar" | "shortcut";
  type: (typeof MODE_INFO)[keyof typeof MODE_INFO]["name"];
};

type UnsavedChangesSeen = {
  name: "unsavedChanges.seen";
};

export type InpIssuesSeen = {
  name: "inpIssues.seen";
  issues:
    | "unsupportedSections"
    | "extendedPeriodSimulation"
    | "nodesMissingCoordinates"
    | "invalidVertices"
    | "invalidCoordinates"
    | "nonDefaultOptions"
    | "nonDefaultTimes"
    | "unbalancedDiff"[];
};

type SimulationSummarySeen = {
  name: "simulationSummary.seen";
  status: "success" | "failure";
  duration?: number;
};

type UserEvent =
  | AssetCreated
  | AssetSelected
  | AssetDeselected
  | AssetEdited
  | AnalysisApplied
  | SatelliteViewToggled
  | AssetsDeleted
  | WelcomeSeen
  | WelcomeOpened
  | WelcomeHidden
  | WelcomeEnabled
  | UnsavedChangesSeen
  | ExampleModelOpened
  | SimulationExecuted
  | ReportOpened
  | OpenModelStarted
  | NewModelStarted
  | ModelSaved
  | OperationUndone
  | OperationRedone
  | DrawingModeEnabled
  | MultiSelectUpdated
  | FullSelectionEnabled
  | SelectionCleared
  | InpIssuesSeen
  | SimulationSummarySeen;

const debugPostHog = {
  capture: (...data: any[]) => {
    // eslint-disable-next-line
    console.log("USER_TRACKING", ...data);
  },
};

export const useUserTracking = () => {
  const posthog = usePostHog();

  const capture = useCallback(
    (event: UserEvent) => {
      const { name, ...metadata } = event;
      posthog.capture(name, metadata);
      isDebugOn && debugPostHog.capture(name, metadata);
    },
    [posthog],
  );

  return { capture };
};
