import type { PanelType } from "./panel";
import type {
  PanelContentState,
  PanelContentStateByType,
} from "./panel-template";

export const contentStateFor = <T extends PanelType>(
  states: Record<string, PanelContentState>,
  panelId: string,
  _panelType: T,
): PanelContentStateByType[T] | undefined =>
  states[panelId] as PanelContentStateByType[T] | undefined;

export const withContentState = <T extends PanelType>(
  states: Record<string, PanelContentState>,
  panelId: string,
  _panelType: T,
  contentState: PanelContentStateByType[T],
): Record<string, PanelContentState> => ({
  ...states,
  [panelId]: contentState,
});
