import { atom } from "jotai";
import {
  panelLayoutStateAtom,
  type PanelDefinition,
  type PanelEntry,
} from "src/state/panel-layout";
import { DataTablesPanel } from "./data-tables";
import { ProfileViewPanel } from "./profile-view";

export const PANEL_DEFINITIONS: PanelDefinition[] = [
  {
    id: "data-tables",
    labelKey: "dataTables.title",
    component: DataTablesPanel,
    defaultZone: { horizontal: "bottom", vertical: "bottom" },
  },
  {
    id: "profile-view",
    labelKey: "profileView.title",
    component: ProfileViewPanel,
    defaultZone: { horizontal: "bottom", vertical: "bottom" },
  },
];

export const panelRegistryAtom = atom<PanelEntry[]>((get) => {
  const state = get(panelLayoutStateAtom);
  return PANEL_DEFINITIONS.map((def) => ({ ...def, ...state[def.id] }));
});
