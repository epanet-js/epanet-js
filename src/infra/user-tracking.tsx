import { PostHogProvider, usePostHog } from "posthog-js/react";
import { useCallback } from "react";
import { Asset, HeadlossFormula } from "src/hydraulic-model";
import { isDebugOn } from "./debug-mode";
import { MODE_INFO, SimulationState } from "src/state/jotai";
import { Presets } from "src/model-metadata/quantities-spec";
import { EpanetUnitSystem } from "src/simulation/build-inp";
import { User } from "src/auth";
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

type AssetPropertyEdited = {
  name: "assetProperty.edited";
  type: Asset["type"];
  property: string;
  newValue: number | null;
  oldValue: number | null;
};

type AssetStatusEdited = {
  name: "assetStatus.edited";
  type: Asset["type"];
  property: string;
  newValue: string | null;
  oldValue: string | null;
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
  count: number;
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

export type AssetDeleted = {
  name: "asset.deleted";
  source: "shortcut" | "toolbar" | "context-menu";
  type: Asset["type"];
};

export type AssetsDeleted = {
  name: "assets.deleted";
  source: "shortcut" | "toolbar" | "context-menu";
  count: number;
};

type WelcomeSeen = {
  name: "welcome.seen";
};

export type WelcomeOpened = {
  name: "welcome.opened";
  source: "menu" | "inpIssues" | "geocodeError" | "missingCoordinatesError";
};

type WelcomeHidden = {
  name: "welcome.hidden";
};

type WelcomeEnabled = {
  name: "welcome.enabled";
};

type ExampleModelStarted = {
  name: "exampleModel.started";
  modelName: string;
};

type SimulationExecuted = {
  name: "simulation.executed";
  source: "shortcut" | "toolbar";
};

type ReportOpened = {
  name: "report.opened";
  source: "shortcut" | "resultDialog" | "toolbar";
  status: SimulationState["status"];
};

type OpenModelStarted = {
  name: "openModel.started";
  source: "shortcut" | "welcome" | "onboarding" | "toolbar" | "drop";
};

export type OpenModelCompleted = {
  name: "openModel.completed";
  counts: Record<string, number>;
  headlossFormula: HeadlossFormula;
  units: EpanetUnitSystem;
  issues: (
    | "unsupportedSections"
    | "extendedPeriodSimulation"
    | "nodesMissingCoordinates"
    | "invalidVertices"
    | "invalidCoordinates"
    | "nonDefaultOptions"
    | "nonDefaultTimes"
    | "unbalancedDiff"
  )[];
};

type NewModelStarted = {
  name: "newModel.started";
  source: "shortcut" | "toolbar" | "welcome";
};

type NewModelCompleted = {
  name: "newModel.completed";
  units: keyof Presets;
  headlossFormula: HeadlossFormula;
};

type ModelSaved = {
  name: "model.saved";
  source: "shortcut" | "toolbar" | "onboarding" | "unsavedDialog";
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

type InpIssuesSeen = {
  name: "inpIssues.seen";
};
type InpIssuesExpanded = {
  name: "inpIssues.expanded";
};
type CoordinatesIssuesExpanded = {
  name: "coordinatesIssues.expanded";
};
type GeocodingNotSupportedSeen = {
  name: "geocodingNotSupported.seen";
};
type MissingCoordinatesSeen = {
  name: "missingCoordinates.seen";
};
type OpenErrorSeen = {
  name: "openError.seen";
};

type SimulationSummarySeen = {
  name: "simulationSummary.seen";
  status: "success" | "failure";
  duration?: number;
};

type ShortcutsOpened = {
  name: "shortcuts.opened";
  source: "menu" | "shortcut" | "onboarding";
};

type PropertyAggregateOpened = {
  name: "propertyAggregate.opened";
  property: string;
};

type QuickStartVisited = {
  name: "quickStart.visited";
  source: "welcome";
};

type HelpCenterVisited = {
  name: "helpCenter.visited";
  source: "welcome" | "menu";
};

type RepoVisited = {
  name: "repo.visited";
  source: "welcome" | "menu";
};

type SignInStarted = {
  name: "signIn.started";
  source: "menu";
};

type SignUpStarted = {
  name: "signUp.started";
  source: "menu";
};

type LogOutCompleted = {
  name: "logOut.completed";
};

type SubscriptionStarted = {
  name: "subscription.started";
  source: "geocodeError" | "inpIssues";
};

type UserEvent =
  | AssetCreated
  | AssetSelected
  | AssetDeselected
  | AssetPropertyEdited
  | AssetStatusEdited
  | AnalysisApplied
  | SatelliteViewToggled
  | AssetsDeleted
  | AssetDeleted
  | WelcomeSeen
  | WelcomeOpened
  | WelcomeHidden
  | WelcomeEnabled
  | UnsavedChangesSeen
  | ExampleModelStarted
  | SimulationExecuted
  | ReportOpened
  | OpenModelStarted
  | OpenModelCompleted
  | OpenErrorSeen
  | NewModelStarted
  | NewModelCompleted
  | ModelSaved
  | OperationUndone
  | OperationRedone
  | DrawingModeEnabled
  | MultiSelectUpdated
  | FullSelectionEnabled
  | SelectionCleared
  | InpIssuesSeen
  | InpIssuesExpanded
  | CoordinatesIssuesExpanded
  | MissingCoordinatesSeen
  | GeocodingNotSupportedSeen
  | SimulationSummarySeen
  | ShortcutsOpened
  | PropertyAggregateOpened
  | QuickStartVisited
  | HelpCenterVisited
  | RepoVisited
  | SignUpStarted
  | SignInStarted
  | LogOutCompleted
  | SubscriptionStarted;

const debugPostHog = {
  capture: (...data: any[]) => {
    // eslint-disable-next-line
    console.log("USER_TRACKING:CAPTURE", ...data);
  },
  identify: (...data: any[]) => {
    // eslint-disable-next-line
    console.log("USER_TRACKING:IDENTIFY", ...data);
  },
  reset: () => {
    // eslint-disable-next-line
    console.log("USER_TRACKING:RESET");
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

  const identify = useCallback(
    (user: User) => {
      const properties = {
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
      };
      posthog.identify(user.id, properties);
      isDebugOn && debugPostHog.identify(user.id, properties);
    },
    [posthog],
  );

  const isIdentified = useCallback(() => {
    return posthog._isIdentified();
  }, [posthog]);

  const reset = useCallback(() => {
    posthog.reset();
    isDebugOn && debugPostHog.reset();
  }, [posthog]);

  return { identify, capture, isIdentified, reset };
};
