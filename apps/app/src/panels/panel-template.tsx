import type { ComponentType } from "react";
import type { Getter, Setter } from "jotai";
import type { TranslateFn } from "src/hooks/use-translate";
import type { useUserTracking } from "src/infra/user-tracking";
import type { Dock } from "./docks";
import type { Panel, PanelOfType, PanelType } from "./panel";
import type { DataGridState } from "./data-tables/grid-state";
import { assetTablePanel, customerPointTablePanel } from "./data-tables/panel";
import { hglProfilePanel } from "./hgl-profile/panel";

export type PanelLifecycleContext = {
  get: Getter;
  set: Setter;
  userTracking: ReturnType<typeof useUserTracking>;
};

export type PanelTemplate<T extends PanelType> = {
  component: ComponentType<{ panel: PanelOfType<T> }>;
  buildLabel: (panel: PanelOfType<T>, translate: TranslateFn) => string;
  onDeactivate?: (
    context: PanelLifecycleContext,
    panel: PanelOfType<T>,
  ) => void;
  onClose?: (context: PanelLifecycleContext, panel: PanelOfType<T>) => void;
};

export type PanelLayout = {
  movedToDock?: Dock;
  renamedTo?: string;
};

export type PanelContentStateByType = {
  "asset-table": DataGridState;
  "customer-point-table": DataGridState;
  "hgl-profile": undefined;
};

export type PanelContentState =
  PanelContentStateByType[keyof PanelContentStateByType];

const panelTemplates = {
  "asset-table": assetTablePanel,
  "customer-point-table": customerPointTablePanel,
  "hgl-profile": hglProfilePanel,
} satisfies { [K in PanelType]: PanelTemplate<K> };

export const panelFor = (panel: Panel): PanelTemplate<PanelType> =>
  panelTemplates[panel.type] as PanelTemplate<PanelType>;

export const panelLabel = (
  panel: Panel,
  renamedTo: string | undefined,
  translate: TranslateFn,
): string => renamedTo ?? panelFor(panel).buildLabel(panel, translate);

export const PanelContent = ({ panel }: { panel: Panel }) => {
  const Component = panelFor(panel).component;
  return <Component panel={panel} />;
};

export const contentStateFor = <T extends PanelType>(
  states: Record<string, PanelContentState>,
  panel: PanelOfType<T>,
): PanelContentStateByType[T] | undefined =>
  states[panel.id] as PanelContentStateByType[T] | undefined;

export const withContentState = <T extends PanelType>(
  states: Record<string, PanelContentState>,
  panel: PanelOfType<T>,
  contentState: PanelContentStateByType[T],
): Record<string, PanelContentState> => ({
  ...states,
  [panel.id]: contentState,
});
