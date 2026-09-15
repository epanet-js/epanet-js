import { createContext, useContext } from "react";
import type { Dock } from "./docks";

export const PanelDockContext = createContext<Dock | undefined>(undefined);

export const useSideTowardMap = (): "left" | "right" =>
  useContext(PanelDockContext) === "left" ? "right" : "left";
