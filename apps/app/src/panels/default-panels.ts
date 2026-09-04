import type { Panel } from "./panel";
import { defaultDataTablePanels } from "./data-tables/create-panel";

export const defaultPanels = (): Panel[] => [...defaultDataTablePanels()];
