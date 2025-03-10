import { PostHogProvider, usePostHog } from "posthog-js/react";
import { useCallback } from "react";
import { Asset } from "src/hydraulic-model";
import { isDebugOn } from "./debug-mode";
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
};

type UserEvent =
  | AssetCreated
  | AssetEdited
  | AnalysisApplied
  | SatelliteViewToggled
  | AssetsDeleted
  | WelcomeOpened
  | WelcomeHidden
  | WelcomeEnabled
  | ExampleModelOpened
  | SimulationExecuted
  | ReportOpened
  | OpenModelStarted
  | NewModelStarted
  | ModelSaved;

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
